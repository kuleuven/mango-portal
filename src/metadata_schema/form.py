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
)
import wtforms.widgets
from werkzeug.datastructures import MultiDict

from irods.meta import iRODSMeta, AVUOperation

from irods.models import Column, Collection, DataObject, DataObjectMeta, CollectionMeta
from irods.column import Criterion

from irods.query import Query


from slugify import slugify

from pprint import pprint

import lib.util
from lib.util import flatten_josse_schema
from metadata_schema.editor import get_metadata_schema_dir

import signals

metadata_schema_form_bp = Blueprint(
    "metadata_schema_form_bp", __name__, template_folder="templates/metadata_schema",
)


def josse_process_property(property_tuple, required=False, prefix=""):
    """
    """
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
            if _property["format"] == "textarea":
                return TextAreaField(label=_property["title"], validators = _validators)
        else:
            return StringField(label=_property["title"], validators=_validators)
    if _property["type"] == "number":
        range_args = {}
        if "minimum" in _property:
            range_args["min"] = _property["minimum"]
        if "maximum" in _property:
            range_args["max"] = _property["maximum"]
        if range_args:
            _validators += [validators.NumberRange(**range_args)]
        return IntegerField(label=_property["title"], validators=_validators,)
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


@metadata_schema_form_bp.route("/metadata-schema/formtest")
def form_test():
    """
    """
    template_name = "another-schema.json"
    json_template_dir = os.path.abspath("static/metadata-templates")
    with open(f"{json_template_dir}/{template_name}") as template_file:
        form_dict = json.load(template_file)
    schema_form_class = josse_walk_schema_object(("", form_dict))
    setattr(schema_form_class, "submit", SubmitField(label="Submit/Update"))
    schema_form = schema_form_class(request.values)

    schema_dict = flatten_josse_schema(
        ("", form_dict), level=0, prefix="ku.another-schema", result_dict={}
    )
    print(f"final")
    pprint(schema_dict)

    return render_template(
        "schema_form_test.html.j2", schema_form=schema_form, title=form_dict["title"]
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

def get_schema_prefix(schema_identifier = False, schema_filename = False):
    if schema_identifier:
        return f"{current_app.config['MANGO_PREFIX']}.{schema_identifier}"
    if schema_filename:
        return f"{current_app.config['MANGO_PREFIX']}.{get_schema_prefix_from_filename(schema_filename)}"


@metadata_schema_form_bp.route("/metada-schema/edit", methods=["POST", "GET"])
def edit_schema_metadata_for_item():
    """
    """
    _parameters = request.values.to_dict()

    # print("Raw request data")
    # print(request.values)
    # print("request data as mutable dict")
    # pprint(_parameters)
    item_type = _parameters["item_type"]
    object_path = _parameters["object_path"]
    if not object_path.startswith("/"):
        object_path = "/" + object_path
    template_name = _parameters["schema"]
    prefix = get_schema_prefix(schema_filename=template_name) #f"{current_app.config['MANGO_PREFIX']}.{get_schema_prefix_from_filename(template_name)}"
    form_dict={}
    json_template_dir = get_metadata_schema_dir(g.irods_session)

    with open(f"{json_template_dir}/{template_name}") as template_file:
        form_dict = json.load(template_file)

    # needed for getting and setting specific values, for example multivalued fields like the checkboxes
    flat_form_dict = flatten_josse_schema(
        ("", form_dict), level=0, prefix=prefix, result_dict={}
    )
    print("flat form dict")
    pprint(flat_form_dict)

    # filters = []

    # if item_type == "data_object":
    #     filters += [Criterion("=", DataObject.replica_number, 0)]

    # filters += [Criterion("=", DataObject.id, _parameters["id"])]
    #     if item_type == "data_object"
    #     else [Criterion("=", Collection.id, _parameters["id"])]

    # item = DataObject if item_type == "data_object" else Collection
    # pprint(filters)

    # pprint(filters)

    # item_query = Query(g.irods_session, item).filter(*filters)
    # query_result = item_query.one()
    # if item_type == 'data_object':
    #     pprint(query_result[DataObject.path])
    catalog_item = (
        g.irods_session.data_objects.get(object_path)
        if item_type == "data_object"
        else g.irods_session.collections.get(object_path)
    )
    setattr(catalog_item, "item_type", item_type)

    form_values = MultiDict()
    # form_values.extend(_parameters)
    for _key, _value in _parameters.items():
        pprint(f"Key is: {_key}")

        form_values.add(_key, _value)
    form_values.add('redirect_hash', '#metadata')

    for meta_data_item in catalog_item.metadata.items():
        if meta_data_item.name.startswith(prefix):
            # if flat_form_dict[meta_data_item.name]["type"] == "checkboxes":
            #     try:
            #         meta_data_item.value = json.loads(_value)
            #     except:
            #         pass
            form_values.add(meta_data_item.name, meta_data_item.value)
    # print("data from irods:")
    # pprint(form_values)

    if request.method == "GET":

        schema_form_class = josse_walk_schema_object((prefix, form_dict), prefix=prefix)
        setattr(schema_form_class, "id", HiddenField())
        setattr(schema_form_class, "schema", HiddenField())
        setattr(schema_form_class, "object_path", HiddenField())
        setattr(schema_form_class, "item_type", HiddenField())
        setattr(schema_form_class, "redirect_hash", HiddenField())
        setattr(schema_form_class, "submit", SubmitField(label="Save"))
        schema_form = schema_form_class(form_values)
        return render_template(
            "schema_form_edit.html.j2",
            schema_form=schema_form,
            title=form_dict["title"],
            item=catalog_item,
        )

    if request.method == "POST":
        """
        """


        # remove all relevant attributes for this schema
        # remove operations:
        avu_operation_list = []
        for meta_data_item in catalog_item.metadata.items():
            if meta_data_item.name.startswith(prefix):
                avu_operation_list.append(
                    AVUOperation(operation="remove", avu=meta_data_item)
                )
        for _key, _value in _parameters.items():

            if _key.startswith(prefix) and _value:
                if flat_form_dict[_key]["type"] == "checkboxes":

                    _value = json.dumps(_value)
                avu_operation_list.append(
                    AVUOperation(operation="add", avu=iRODSMeta(_key, _value))
                )

        #catalog_item.metadata.apply_atomic_operations(*avu_operation_list)
        # workaround for a bug in 4.2.11
        lib.util.execute_atomic_operations(g.irods_session, catalog_item, avu_operation_list)

        if item_type == "collection":
            signals.collection_changed.send(current_app._get_current_object(), irods_session = g.irods_session, collection_path=object_path)
        if item_type == "data_object":
            signals.data_object_changed.send(current_app._get_current_object(), irods_session = g.irods_session, data_object_path=object_path)

#signals.data_object_changed(current_app._get_current_object(), data_object_path=data_object_path)
        if item_type == "collection":
            referral = url_for("browse_bp.collection_browse", collection=catalog_item.path)
        else:
            referral = url_for("browse_bp.view_object", data_object_path=catalog_item.path)

        if "redirect_route" in request.values:
            return redirect(request.values["redirect_route"])
        if "redirect_hash" in request.values:
            return redirect(
                referral.split("#")[0] + request.values["redirect_hash"]
            )
        return redirect(request.referrer)



@metadata_schema_form_bp.route("/metadata-schema/delete", methods=["POST"])
def delete_schema_metadata_for_item():
    """
    """
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

    #catalog_item.metadata.apply_atomic_operations(*avu_operation_list)
    # workaround for a bug in 4.2.11
    lib.util.execute_atomic_operations(g.irods_session, catalog_item, avu_operation_list)

    if item_type == "collection":
            signals.collection_changed.send(current_app._get_current_object(), collection_path=item_path)
    if item_type == "data_object":
        signals.data_object_changed.send(current_app._get_current_object(), data_object_path=item_path)

    if item_type == "collection":
        referral = url_for("browse_bp.collection_browse", irods_session = g.irods_session, collection=catalog_item.path)
    else:
        referral = url_for("browse_bp.view_object", irods_session = g.irods_session, data_object_path=catalog_item.path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            referral.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)
