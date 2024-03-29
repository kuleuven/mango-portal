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


def josse_process_property(property_tuple, required=False, prefix=""):
    """ """
    (_key, _property) = property_tuple
    _validators = [validators.InputRequired()] if required else []
    if _property["type"] == "string":
        if "format" in _property:
            if _property["format"] == "email":
                return EmailField(label=_property["title"], validators=_validators)
            if _property["format"] == "date":
                return DateField(label=_property["title"], validators=_validators)
            if _property["format"] == "uri":
                return URLField(label=_property["title"], validators=_validators)
            if _property["format"] == "time":
                return TimeField(label=_property["title"], validators=_validators)
            if _property["format"] == "float":
                return FloatField(label=_property["title"], validators=_validators)
        else:
            return StringField(label=_property["title"], validators=_validators)
    if _property["type"] == "textarea":
        return TextAreaField(
            label=_property["title"],
            validators=_validators,
            render_kw={"class": "form-control", "rows": 5, "maxlength": 1500},
        )
    if _property["type"] == "float":
        return FloatField(label=_property["title"], validators=_validators)
    if _property["type"] == "number":
        range_args = {}
        if "minimum" in _property:
            range_args["min"] = _property["minimum"]
        if "maximum" in _property:
            range_args["max"] = _property["maximum"]
        if range_args:
            _validators += [validators.NumberRange(**range_args)]
        return IntegerField(
            label=_property["title"],
            validators=_validators,
        )
    if _property["type"] == "checkboxes":
        #### new try
        choices = [*_property["properties"]]
        return SelectMultipleField(
            label=_property["title"],
            choices=choices,
            validators=_validators,
            option_widget=wtforms.widgets.CheckboxInput,
        )

        class _p_form_class(Form):
            pass

        for _cb_key, _cb_property in _property["properties"].items():
            setattr(_p_form_class, _cb_key, BooleanField(label=_cb_property["title"]))
        return FormField(
            _p_form_class,
            label=_property["title"],
            validators=_validators,
            separator=".",
        )
    if _property["type"] == "select":
        if not required:
            _property["enum"] = [""] + _property["enum"]
        return SelectField(
            label=_property["title"], choices=_property["enum"], validators=_validators
        )

    if _property["type"] == "radio":
        return RadioField(
            label=_property["title"], choices=_property["enum"], validators=_validators
        )

    return StringField(
        label=f"unprocessed type {_property['type']}: {_property['title']}"
    )


def josse_walk_schema_object(object_tuple, level=0, prefix=""):
    """
    item_tuple is a key / dict "object" that has properties to walk further down
    schema format is from the student delivered "tempate editor"
    returns a wtforms form object
    note that the first titl property will also be used as a prefix
    """
    (_key, _dict) = object_tuple

    class schema_form_class(FlaskForm):
        pass

    # if level == 0:
    #     prefix = _dict["title"] if prefix == "" else f"{prefix}.{_key}"
    # else:
    #     prefix = f"{prefix}.{_key}"

    for p_key, _property in _dict["properties"].items():
        # Preprocessing/sanitizing
        # Checkboxes type
        if p_key.endswith("_checkboxes"):
            # chop off the type from the label
            p_key = p_key[: -len("_checkboxes")]
            # put the type where it belongs
            _property["type"] = "checkboxes"
        # select or radio buttons: presence of enum list an its size
        if "enum" in _property:
            _property["type"] = "select" if len(_property["enum"]) >= 5 else "radio"
        # Real processing: either get a new (possible composite field) or walk down a child object

        if _property["type"] == "object":
            sub_form = josse_walk_schema_object((p_key, _property), level=(level + 1))
            setattr(
                schema_form_class,
                f"{prefix}.{p_key}",
                FormField(sub_form, label=_property["title"], separator="."),
            )
        else:
            sub_field = josse_process_property(
                (p_key, _property),
                required=True if p_key in _dict["required"] else False,
            )
            if level == 0:
                p_key = f"{prefix}.{p_key}"

            setattr(schema_form_class, p_key, sub_field)

    return schema_form_class



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

def add_to_dict(metadata_items, multidict, unit_level=1):
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
        add_to_dict(composite_items, subdict, unit_level + 1)
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

    # json_template_dir = get_metadata_schema_dir(g.irods_session)

    # with open(f"{json_template_dir}/{template_name}") as template_file:
    #     form_dict = json.load(template_file)

    # needed for getting and setting specific values, for example multivalued fields like the checkboxes
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
    # form_values.extend(_parameters)
    # _parameters = {'mg.schema1.key1' : 'value1', 'mg.schema2.key2' : 'value2'} # for testing
    # for _key, _value in _parameters.items():
    #     pprint(f"Key is: {_key}")

    #     form_values.add(_key, _value)
    form_values.add("redirect_route", request.referrer + "#metadata")
    add_to_dict(catalog_item.metadata.items(), form_values)
    # for meta_data_item in catalog_item.metadata.items():
    #     if meta_data_item.name.startswith(prefix):
    #         form_values.add(
    #             meta_data_item.name, meta_data_item.value.replace("<br/>", "\n")
    #         )

    values_json = json.dumps(form_values.to_dict(flat=False))

    if request.method == "GET":
        # schema_form_class = josse_walk_schema_object((prefix, form_dict), prefix=prefix)
        # setattr(schema_form_class, "id", HiddenField())
        # setattr(schema_form_class, "schema", HiddenField())
        # setattr(schema_form_class, "object_path", HiddenField())
        # setattr(schema_form_class, "item_type", HiddenField())
        # setattr(schema_form_class, "redirect_hash", HiddenField())
        # setattr(schema_form_class, "submit", SubmitField(label="Save"))
        # schema_form = schema_form_class(form_values)
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

        # catalog_item.metadata.apply_atomic_operations(*avu_operation_list)
        # workaround for a bug in 4.2.11: only 'own' can execute atomic operations
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

        # signals.data_object_changed(current_app._get_current_object(), data_object_path=data_object_path)
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

    # catalog_item.metadata.apply_atomic_operations(*avu_operation_list)
    # workaround for a bug in 4.2.11
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
