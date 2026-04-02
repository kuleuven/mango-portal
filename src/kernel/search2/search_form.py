from wtforms import (
    BooleanField,
    DateField,
    FieldList,
    Form,
    FormField,
    HiddenField,
    RadioField,
    SelectField,
    StringField,
    SubmitField,
    validators,
)


class AVUForm(Form):
    """AVU input no schema with label"""

    meta_a = StringField("Attribute name")
    meta_v = StringField("Attribute value")
    meta_u = StringField("Unit value")


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
    meta_v = StringField(
        "Attribute value", render_kw={"data-target": "meta-value-label"}
    )


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
                field.schema.choices = [("", "Please select a schema")] + schemas


    item_name = FormField(ItemTypeNameForm, label="Name")
    collection_subtree = FormField(CollectionForm, label="Subtree filter")
    create_date = FormField(ItemDateForm, label="Created")
    mod_date = FormField(ItemDateForm, label="Modified")
    schema_metadata = FieldList(
        FormField(AVUSchema, label="metadata"),
        min_entries=1,
    )
    non_schema_metadata = FieldList(
        FormField(AVUForm, label="metadata"),
        min_entries=1,
    )
    per_page = HiddenField("per_page")
    total = HiddenField("total")
    submit = SubmitField("Search")
