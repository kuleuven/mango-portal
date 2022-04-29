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
)
from irods.meta import iRODSMeta

metadata_schema_form_bp = Blueprint(
    "metadata_schema_form_bp", __name__, template_folder="templates/metadata_schema",
)


def josse_process_property(property_tuple, required=False):
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

        class _p_form_class(Form):
            pass

        for _cb_key, _cb_property in _property["properties"].items():
            setattr(_p_form_class, _cb_key, BooleanField(label=_cb_property["title"]))
        return FormField(
            _p_form_class, label=_property["title"], validators=_validators
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


def josse_walk_object(object_tuple, level=0, prefix=""):
    """
    item_tuple is a key / dict "object" that has properties to walk further down
    schema format is from the student delivered "tempate editor"
    returns a wtforms form object
    note that the first titl property will also be used as a prefix
    """
    (_key, _dict) = object_tuple

    class schema_form_class(FlaskForm):
        pass

    if level == 0:
        prefix = _dict["title"] if prefix == "" else f"{prefix}.{_key}"
    else:
        prefix = f"{prefix}.{_key}"

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
            sub_form = josse_walk_object(
                (p_key, _property), level=(level + 1), prefix=f"{prefix}.{p_key}"
            )
            setattr(schema_form_class, p_key, FormField(sub_form))
        else:
            sub_field = josse_process_property(
                (p_key, _property),
                required=True if p_key in _dict["required"] else False,
            )
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
    schema_form_class = josse_walk_object(("", form_dict))
    setattr(schema_form_class, "submit", SubmitField(label="Submit/Update"))
    schema_form = schema_form_class(request.values)

    return render_template(
        "schema_form_test.html.j2", schema_form=schema_form, title=form_dict["title"]
    )
