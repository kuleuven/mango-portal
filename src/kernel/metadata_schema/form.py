from unittest import result
from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    g,
    send_file,
    abort,
    stream_with_context,
    Response,
    request,
    flash,
)

import os
import json

from flask_wtf import FlaskForm
from wtforms import (
    StringField,
    EmailField,
    DateField,
    URLField,
    SelectField,
    SubmitField,
    RadioField,
    BooleanField,
    FormField,
    IntegerField,
    validators,
    Form,
    TimeField,
    HiddenField,
    SelectMultipleField,
    TextAreaField,
    FloatField,
)
import wtforms.widgets
from werkzeug.datastructures import MultiDict

from irods.meta import iRODSMeta, AVUOperation

from irods.models import Column, Collection, DataObject, DataObjectMeta, CollectionMeta
from irods.column import Criterion

from irods.query import Query


from slugify import slugify

from csrf import csrf

from pprint import pprint

import lib.util
from lib.util import flatten_josse_schema, flatten_schema
from .editor import get_metadata_schema_dir

from kernel.metadata_schema import get_schema_manager, FileSystemSchemaManager
import logging

import signals


metadata_schema_form_bp = Blueprint(
    "metadata_schema_form_bp",
    __name__,
    template_folder="templates/metadata_schema",
)


def get_schema_prefix_from_filename(filename):
    """
    filename must end with '.json'
    """
    if filename.endswith(".json"):
        filename = filename[:-5]
        return slugify(filename)
    else:
        return False


def get_schema_prefix(schema_identifier=False, schema_filename=False):
    if schema_identifier:
        return f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{schema_identifier}"
    if schema_filename:
        return f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{get_schema_prefix_from_filename(schema_filename)}"

def convert_to_multi_dict(metadata_items, multidict : MultiDict, unit_level=1):
    """
    Converts a list of iRODS metadata items into a nested multidict structure
    """
    name_length = 2 + unit_level
    simple_fields = [
        meta_data_item
        for meta_data_item in metadata_items
        if len(meta_data_item.name.split(".")) == name_length
    ]
    composite_fields = set(
        (
            ".".join(meta_data_item.name.split(".")[:name_length]),
            ".".join(meta_data_item.units.split(".")[:unit_level])
            if meta_data_item.units
            else None,
        )
        for meta_data_item in metadata_items
        if len(meta_data_item.name.split(".")) > name_length
    )
    if len(composite_fields) > 1:
        composite_fields = sorted(
            list(composite_fields), key=lambda x: int(x[1].split(".")[unit_level - 1])
        )
    for meta_data_item in simple_fields:
        multidict.add(meta_data_item.name, meta_data_item.value)
    for composite_name, composite_unit in composite_fields:
        subdict = MultiDict()
        composite_items = [
            meta_data_item
            for meta_data_item in metadata_items
            if meta_data_item.name.startswith(composite_name)
        ]
        if composite_unit:
            subdict.add("__unit__", composite_unit)
            composite_items = [
                meta_data_item
                for meta_data_item in composite_items
                if meta_data_item.units.startswith(composite_unit)
            ]
        convert_to_multi_dict(composite_items, subdict, unit_level + 1)
        multidict.add(composite_name, subdict.to_dict(flat=False))

@metadata_schema_form_bp.route("/metadata-schema/edit", methods=["POST", "GET"])
@csrf.exempt
def edit_schema_metadata_for_item():
    """ """
    _parameters = request.values.to_dict()

    item_type = _parameters["item_type"]
    object_path = _parameters["object_path"]
    if not object_path.startswith("/"):
        object_path = "/" + object_path
    template_name = schema = _parameters["schema"]
    realm = _parameters["realm"]
    prefix = get_schema_prefix(schema_identifier=schema)

    schema_manager: FileSystemSchemaManager = get_schema_manager(
        zone=g.irods_session.zone, realm=realm
    )
    logging.info(f"Using metadata schema {schema}")

    schema_as_json = schema_manager.load_schema(schema_name=schema, status="published")
    logging.info(schema_as_json)
    form_dict = {}
    flat_form_dict = {}
    if schema_as_json:
        form_dict = json.loads(schema_as_json)

    if schema_as_json:
        flat_form_dict = flatten_schema(
            ("", form_dict), level=0, prefix=prefix, result_dict={}
        )

    catalog_item = (
        g.irods_session.data_objects.get(object_path)
        if item_type == "data_object"
        else g.irods_session.collections.get(object_path)
    )
    setattr(catalog_item, "item_type", item_type)

    form_values = MultiDict()
    
    form_values.add("redirect_route", request.referrer + "#metadata")
    convert_to_multi_dict(catalog_item.metadata.items(), form_values)
    
    values_json = json.dumps(form_values.to_dict(flat=False))

    if request.method == "GET":
        return render_template(
            "schema_form_edit.html.j2",
            schema=schema,
            realm=realm,
            schema_values=lib.util.btoa(values_json),
            prefix=prefix,
            item=catalog_item,
        )

    if request.method == "POST":
        """ """

        # remove all relevant attributes for this schema
        # remove operations:
        avu_operation_list = []
        for meta_data_item in catalog_item.metadata.items():
            if meta_data_item.name.startswith(prefix):
                avu_operation_list.append(
                    AVUOperation(operation="remove", avu=meta_data_item)
                )
        for _key, _value in request.values.items(multi=True):
            if _key.startswith(prefix) and _value:
                if (
                    _key in flat_form_dict
                    and flat_form_dict[_key]["type"] == "textarea"
                ):
                    # the value is transformed to replace newlines as iRODS cannot handle this.
                    # Most likely this is only for schemas which can have textarea boxes
                    _value = "<br/>".join(_value.splitlines())

                if isinstance(_value, str):
                    _value = _value.strip()

                if "__" in _key and not _key.endswith("__"):
                    pprint(_key)
                    pprint(_key.split("__"))
                    _key, _unit = _key.split("__")
                    avu_operation_list.append(
                        AVUOperation(
                            operation="add", avu=iRODSMeta(_key, _value, _unit)
                        )
                    )
                else:
                    avu_operation_list.append(
                        AVUOperation(operation="add", avu=iRODSMeta(_key, _value))
                    )

        # workaround for a bug in iRODS < = 4.2.11: only 'own' can execute atomic operations
        lib.util.execute_atomic_operations(
            g.irods_session, catalog_item, avu_operation_list
        )

        if item_type == "collection":
            signals.collection_changed.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                collection_path=object_path,
            )
        if item_type == "data_object":
            signals.data_object_changed.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                data_object_path=object_path,
            )

        if item_type == "collection":
            referral = url_for(
                "browse_bp.collection_browse", collection=catalog_item.path
            )
        else:
            referral = url_for(
                "browse_bp.view_object", data_object_path=catalog_item.path
            )

        if "redirect_route" in request.values:
            return redirect(request.values["redirect_route"])
        if "redirect_hash" in request.values:
            return redirect(referral.split("#")[0] + request.values["redirect_hash"])
        return redirect(request.referrer)


@metadata_schema_form_bp.route("/metadata-schema/delete-metadata", methods=["POST"])
def delete_schema_metadata_for_item():
    """ """
    form_parameters = request.values.to_dict()
    schema_identifier = form_parameters["schema_identifier"]
    item_path = form_parameters["item_path"]
    if not item_path.startswith("/"):
        item_path = "/" + item_path
    item_type = form_parameters["item_type"]

    catalog_item = (
        g.irods_session.data_objects.get(item_path)
        if item_type == "data_object"
        else g.irods_session.collections.get(item_path)
    )
    prefix = get_schema_prefix(schema_identifier=schema_identifier)

    avu_operation_list = []
    for meta_data_item in catalog_item.metadata.items():
        if meta_data_item.name.startswith(prefix):
            avu_operation_list.append(
                AVUOperation(operation="remove", avu=meta_data_item)
            )

    # workaround for a bug in iRODS < = 4.2.11: only 'own' can execute atomic operations
    lib.util.execute_atomic_operations(
        g.irods_session, catalog_item, avu_operation_list
    )

    if item_type == "collection":
        signals.collection_changed.send(
            current_app._get_current_object(), collection_path=item_path
        )
    if item_type == "data_object":
        signals.data_object_changed.send(
            current_app._get_current_object(), data_object_path=item_path
        )

    if item_type == "collection":
        referral = url_for(
            "browse_bp.collection_browse",
            irods_session=g.irods_session,
            collection=catalog_item.path,
        )
    else:
        referral = url_for(
            "browse_bp.view_object",
            irods_session=g.irods_session,
            data_object_path=catalog_item.path,
        )

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(referral.split("#")[0] + request.values["redirect_hash"])
    return redirect(request.referrer)
