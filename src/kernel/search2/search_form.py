from wtforms import (
    BooleanField,
    DateField,
    FieldList,
    Form,
    FormField,
    HiddenField,
    RadioField,
    SelectField,
    SelectMultipleField,
    StringField,
    SubmitField,
    validators,
)
from wtforms.widgets import html_params


class ButtonWidget(object):
    """render a button"""

    input_type = "button"
    html_params = staticmethod(html_params)

    def __call__(self, field, **kwargs):
        kwargs.setdefault("id", field.id)
        kwargs.setdefault("type", self.input_type)
        if "value" not in kwargs:
            kwargs["value"] = field._value()
        params = self.html_params(name=field.name, **kwargs)
        label = '<i class="bi bi-trash"></i>'  # field.label.text

        return f"""<button {params}>{label}</button>"""


class ButtonField(StringField):
    """Remove row button"""

    widget = ButtonWidget()


class AVUForm(Form):
    """AVU input no schema with label"""

    meta_attribute = StringField("Attribute name")
    meta_value = StringField("Attribute value")
    meta_unit = StringField("Unit value")
    remove = ButtonField("      ")


class AVUFormNoLabel(Form):
    """AVU input no schema and no label"""

    meta_attribute = StringField("")
    meta_value = StringField("")
    meta_unit = StringField("")
    remove = ButtonField("")


class AVUSchema(Form):
    """Input field for schema metadata with suggestion list and label"""

    schema = SelectField(
        "Schema",
        validate_choice=False,
        choices=[],
        render_kw={"data-target": "meta-schema-label"},
    )
    meta_a = SelectField(
        "Attribute name",
        validate_choice=False,
        render_kw={
            "data-target": "meta-attribute-label"
        },  # we don't validate because choices will be created dynamically
    )
    meta_v = StringField("Attribute value")
    remove = ButtonField("      ")



class ItemDateForm(Form):
    """Fields for date."""

    comparison = SelectField(
        "Comparison",
        choices=[("before", "Before"), ("after", "After")],
        validate_choice=False,
    )
    date = DateField(
        label="Date", format="%Y-%m-%d", validators=[validators.Optional()]
    )


class ItemTypeNameForm(Form):
    """Fields for Type, Name and Exact Match."""

    item_name = StringField(
        "Specify name",
        render_kw={"placeholder": "Enter the name of the data object or collection"},
    )

    item_type = RadioField(
        "Choose data type",  # add any option
        choices=[
            ("data_object", "Data object"),
            ("collection", "Collection"),
        ],
        default="data_object",
        # validate_choice=False,
    )

    comparison = BooleanField("Exact match")


class CollectionForm(Form):
    """Select field with possible collections."""

    collection = SelectField(
        "Choose collection",
        validate_choice=False,
        choices=[],
    )


class CatalogSearchForm(Form):
    """Class for catalog search form."""

    def __init__(self, subtrees=None, schemas=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if subtrees:
            self.collection_subtree.collection.choices = subtrees
        #  else:
        #       self.collection_subtree.choices = []
        if schemas:
            for field in self.schema_metadata:
                field.schema.choices = schemas

    item_name = FormField(ItemTypeNameForm, label="Name")
    collection_subtree = FormField(CollectionForm, label="Subtree filter")
    create_date = FormField(ItemDateForm, label="Created")
    mod_date = FormField(ItemDateForm, label="Modified")
    schema_metadata = FieldList(
        FormField(AVUSchema, label="metadata"),
        min_entries=1,
    )
    non_schema_metadata = FormField(AVUForm, label="Non schema metadata")
    non_schema_metadata_no_label = FieldList(
        FormField(AVUFormNoLabel),
        min_entries=0,
    )

    per_page = HiddenField("per_page")
    total = HiddenField("total")
    submit = SubmitField("Search")
