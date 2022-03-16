from crypt import methods
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
    jsonify,
)
import json
from flask_wtf import Form, FlaskForm
from wtforms import (
    StringField,
    SelectField,
    validators,
    SubmitField,
    HiddenField,
    FieldList,
    FormField,
    DateField,
)

from lib.util import collection_tree_to_dict

from irods.models import Collection, DataObject, DataObjectMeta, CollectionMeta
from irods.session import iRODSSession
from irods.query import Query
from irods.column import Criterion
from pprint import pprint


basic_search_bp = Blueprint(
    "basic_search_bp", __name__, template_folder="templates/search"
)


class AVUForm(FlaskForm):
    meta_a = StringField("Attribute name")  # , [validators.Length(min=2)])
    meta_v = StringField("Attribute value")  # , [validators.Length(min=2)])
    meta_u = StringField("Attribute unit")


class ItemDateForm(FlaskForm):
    comparison = SelectField(
        "Comparison",
        choices=[("before", "Before"), ("after", "After"), ("equal", "On")],
        validate_choice=False,
    )
    date = DateField(
        label="Date", format="%Y-%m-%d", validators=[validators.Optional()]
    )


class ItemNameForm(FlaskForm):
    item_type = SelectField(
        "Type",
        choices=[("data_object", "Data object"), ("collection", "Collection")],
        validate_choice=False,
    )
    comparison = SelectField(
        choices=[("contains", "Contains"), ("exact_match", "Is equal to")],
        validate_choice=False,
    )
    item_name = StringField("Name")


class CatalogSearchForm(FlaskForm):

    item_name = FormField(ItemNameForm, label="Name")
    avus = FieldList(FormField(AVUForm), min_entries=2, max_entries=3)
    create_date = FormField(ItemDateForm, label="Created")
    mod_date = FormField(ItemDateForm, label="Modified")
    submit = SubmitField("Search")
    # hidden_tag = HiddenField()


def build_basic_query(form):
    """

{'avus-0-meta_a': '',
 'avus-0-meta_u': '',
 'avus-0-meta_v': '',
 'avus-1-meta_a': '',
 'avus-1-meta_u': '',
 'avus-1-meta_v': '',
 'create_date-comparison': 'before',
 'create_date-date': '',
 'csrf_token': 'IjlmZDc4OTFlNzdiOTYyNzg1NWI4Zjc0YTBjM2NkMzNkZDRmNWQwNjki.YjIKRA.SmWr4OGmq8iz-zTIVGTPg1fMj-c',
 'item_name-comparison': 'contains',
 'item_name-item_name': '',
 'item_name-item_type': 'data_object',
 'mod_date-comparison': 'before',
 'mod_date-date': '',
 'submit': 'Search'}

    """
    search_query = g.irods_session.query(
        Collection.name, DataObject.id, DataObject.name, DataObject.size
    )
    if form["item_name-item_name"]:
        crit = "="
        name = form["item_name-item_name"]
        if form["item_name-comparison"] == "contains":
            crit = "like"
            name = "%{form['item_name-item_name']}%"
        column = DataObject.name
        if form["item_name-item_type"] == "collection":
            column = Collection.name
        search_query.filter(Criterion(crit, column, name))

    return search_query


@basic_search_bp.route("/catalog/search", methods=["GET", "POST"])
def catalog_search():
    search_form = CatalogSearchForm(formdata=request.form)
    # pprint(request.form)

    collection_tree = json.dumps(
        [collection_tree_to_dict(g.irods_session.collections.get(g.user_home))]
    )

    if search_form.validate():
        import time
        start = time.time()
        results = build_basic_query(request.form).execute()
        end = time.time()
        return render_template(
            "basic_catalog_search.html.j2",
            search_form=search_form,
            results=build_basic_query(request.form).execute(),
            collection_tree=collection_tree,
            search_time = end-start
        )
    else:
        return render_template(
            "basic_catalog_search.html.j2",
            search_form=search_form,
            results=[],
            collection_tree=collection_tree,
        )
