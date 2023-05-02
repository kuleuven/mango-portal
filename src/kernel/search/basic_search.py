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
    Form,
    SelectMultipleField,
)

from cache import cache
from lib.util import collection_tree_to_dict
from pprint import pprint
from irods.models import (
    Collection,
    DataObject,
    DataObjectMeta,
    CollectionMeta,
    UserMeta,
)
from irods.session import iRODSSession
from irods.query import Query
from irods.column import Criterion, Like
from datetime import datetime
from flask_paginate import Pagination, get_page_parameter

basic_search_bp = Blueprint(
    "basic_search_bp", __name__, template_folder="templates/search"
)


from mango_ui import register_module

UI = {
    "title": "Search",
    "bootstrap_icon": "search",
    "description": "Catalog search",
    "blueprint": basic_search_bp.name,
    "index": "catalog_search",
}

register_module(**UI)

irods_comparison_operator = {
    "after": ">=",
    "equal": "=",
    "before": "<=",
    "contains": "like",
}

# hidden_tag = HiddenField()


def build_basic_query_filters(form):
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
    filters = []
    # avoid the replicated data objects
    if form["item_name-item_type"] == "data_object":
        filters += [Criterion("=", DataObject.replica_number, 0)]

    if form["item_name-item_name"]:
        crit = "="
        name = form["item_name-item_name"]
        if form["item_name-comparison"] == "contains":
            crit = "like"
            name = f"%{form['item_name-item_name']}%"
        column = DataObject.name
        if form["item_name-item_type"] == "collection":
            column = Collection.name
        filters += [Criterion(crit, column, name)]

    column_meta_base = (
        DataObjectMeta
        if form["item_name-item_type"] == "data_object"
        else CollectionMeta
    )

    # if form["any_avu-meta_a"]:
    #     filters += [Criterion("=", column_meta_base.name, form["any_avu-meta_a"])]

    # if form["any_avu-meta_v"]:
    #     comparison = "like" if form["any_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, column_meta_base.value, form["any_avu-meta_v"])
    #     ]

    # if form["any_avu-meta_u"]:
    #     comparison = "like" if form["any_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, column_meta_base.units, form["any_avu-meta_u"])
    #     ]

    for num in [1, 2, 3]:
        if form[f"any_avu{num}-meta_a"]:
            filters += [
                Criterion("=", column_meta_base.name, form[f"any_avu{num}-meta_a"])
            ]

        if form[f"any_avu{num}-meta_v"]:
            comparison = "like" if form[f"any_avu{num}-meta_v"].find("%") != -1 else "="
            filters += [
                Criterion(
                    comparison, column_meta_base.value, form[f"any_avu{num}-meta_v"]
                )
            ]

        if form[f"any_avu{num}-meta_u"]:
            comparison = "like" if form[f"any_avu{num}-meta_u"].find("%") != -1 else "="
            filters += [
                Criterion(
                    comparison, column_meta_base.units, form[f"any_avu{num}-meta_u"]
                )
            ]

    # if form["collection_avu-meta_a"]:
    #     filters += [Criterion("=", CollectionMeta.name, form["collection_avu-meta_a"])]

    # if form["collection_avu-meta_v"]:
    #     comparison = "like" if form["collection_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, CollectionMeta.value, form["collection_avu-meta_v"])
    #     ]

    # if form["collection_avu-meta_u"]:
    #     comparison = "like" if form["collection_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, CollectionMeta.units, form["collection_avu-meta_u"])
    #     ]

    # if form["data_object_avu-meta_a"]:
    #     filters += [Criterion("=", DataObjectMeta.name, form["data_object_avu-meta_a"])]

    # if form["data_object_avu-meta_v"]:
    #     comparison = "like" if form["data_object_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, DataObjectMeta.value, form["data_object_avu-meta_v"])
    #     ]

    # if form["data_object_avu-meta_u"]:
    #     comparison = "like" if form["data_object_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, DataObjectMeta.value, form["data_object_avu-meta_u"])
    #     ]

    if form["create_date-date"]:
        column = (
            DataObject.create_time
            if form["item_name-item_type"] == "data_object"
            else Collection.create_time
        )
        comparison = ">=" if form["create_date-comparison"] == "after" else "<="
        filters += [
            Criterion(
                comparison, column, datetime.fromisoformat(form["create_date-date"])
            )
        ]
        # filters += [(column >= datetime.fromisoformat(form["create_date-date"]))]

    if form["mod_date-date"]:
        column = (
            DataObject.create_time
            if form["item_name-item_type"] == "data_object"
            else Collection.create_time
        )
        comparison = ">=" if form["mod_date-comparison"] == "after" else "<="
        filters += [
            Criterion(comparison, column, datetime.fromisoformat(form["mod_date-date"]))
        ]

    if form["collection_subtree-collection"]:
        if form["item_name-item_type"] == "collection":

            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

        else:
            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

    return filters


@basic_search_bp.route("/catalog/search", methods=["GET", "POST"])
def catalog_search():

    # cache for 5 minutes using all the arguments as a key, user specific!
    @cache.memoize(300)
    def get_meta_attribute_names(type=DataObjectMeta.name, user=None, zone=None):
        current_app.logger.info(
            f"Creating/refreshing metadata attribute (name) cache for user {user}"
        )
        return g.irods_session.query(type).all()

    class AVUForm(Form):
        meta_a = StringField("Attribute name")  # , [validators.Length(min=2)])
        meta_v = StringField("Attribute value")  # , [validators.Length(min=2)])
        meta_u = StringField("Attribute unit")

        # data object variant with <data> search suggestions

    class AVUFormSuggestionList(Form):
        meta_a = StringField("Attribute name", render_kw={"list": "search_meta_names"})
        meta_v = StringField("Attribute value")
        meta_u = StringField("Attribute unit")

    class AVUFormSuggestionListNoLabel(Form):
        meta_a = StringField("", render_kw={"list": "search_meta_names"})
        meta_v = StringField("")
        meta_u = StringField("")

    # # data object variant with <data> search suggestions
    # class AVUFormSuggestionListDO(Form):
    #     meta_a = StringField(
    #         "Attribute name", render_kw={"list": "do_search_meta_names"}
    #     )
    #     meta_v = StringField("Attribute value")
    #     meta_u = StringField("Attribute unit")

    # # collection variant with <data> search suggestions
    # class AVUFormSuggestionListCO(Form):
    #     meta_a = StringField(
    #         "Attribute name", render_kw={"list": "co_search_meta_names"}
    #     )
    #     meta_v = StringField("Attribute value")
    #     meta_u = StringField("Attribute unit")

    class ItemDateForm(Form):
        comparison = SelectField(
            "Comparison",
            choices=[("before", "Before"), ("after", "After")],
            validate_choice=False,
        )
        date = DateField(
            label="Date", format="%Y-%m-%d", validators=[validators.Optional()]
        )

    class ItemTypeNameForm(Form):
        item_type = SelectField(
            "Type",  # add any option
            choices=[("data_object", "Data object"), ("collection", "Collection"),],
            validate_choice=False,
        )
        comparison = SelectField(
            choices=[("contains", "Contains"), ("exact_match", "Is equal to")],
            validate_choice=False,
        )
        item_name = StringField("Name")

    # create a list of first level collections to refine the search
    base = g.irods_session.collections.get(f"/{g.irods_session.zone}/home")
    subtrees = [base.path] + [collection.path for collection in base.subcollections]
    user_home = f"{g.irods_session.zone}/home/{g.irods_session.username}"

    class ColllectionForm(Form):
        collection = SelectField(
            "Collection (subtree)", validate_choice=False, choices=subtrees,
        )

    class CatalogSearchForm(Form):
        collection_subtree = FormField(ColllectionForm, label="Subtree filter")
        item_name = FormField(ItemTypeNameForm, label="Name")
        # data_object_avu = FormField(
        #     AVUFormSuggestionListDO, label="Data object metadata"
        # )
        # collection_avu = FormField(
        #     AVUFormSuggestionListCO, label="Collection metadata"
        # )
        any_avu1 = FormField(AVUFormSuggestionList, label="Metadata")
        any_avu2 = FormField(AVUFormSuggestionListNoLabel, label="Metadata")
        any_avu3 = FormField(AVUFormSuggestionListNoLabel, label="Metadata")
        create_date = FormField(ItemDateForm, label="Created")
        mod_date = FormField(ItemDateForm, label="Modified")
        per_page = HiddenField("per_page")
        total = HiddenField("total")
        submit = SubmitField("Search")

    current_app.logger.info(request.values)
    data_object_meta_names = get_meta_attribute_names(
        DataObjectMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    )
    # collection_meta_names = get_meta_attribute_names(
    #     CollectionMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    # )
    # user_meta_names = get_meta_attribute_names(
    #     UserMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    # )
    meta_names = []
    current_app.logger.info(
        f"Got {data_object_meta_names.length} items for data objects"
    )
    for item in data_object_meta_names:
        meta_names.append(item[DataObjectMeta.name])
        # pprint(item)
    # pprint(meta_names)
    # print(f"Got {collection_meta_names.length} items for collections")
    # for item in collection_meta_names:
    #     pprint(item)
    # print(f"Got {user_meta_names.length} items for users")
    # for item in user_meta_names:
    #     pprint(item)

    # collection_tree = json.dumps(
    #     [collection_tree_to_dict(g.irods_session.collections.get(g.user_home))]
    # )

    # pprint(cache)
    search_form = CatalogSearchForm(formdata=request.values, per_page=20)

    if request.values.get("submit", False) == "Search" and search_form.validate():
        import time

        start = time.time()
        filters = build_basic_query_filters(request.values)
        objects = (
            [Collection.name, Collection.owner_name]
            if request.values["item_name-item_type"] == "collection"
            else [
                Collection.name,
                DataObject.name,
                DataObject.size,
                DataObject.owner_name,
            ]
        )
        # objects = (
        #     Collection
        #     if request.values["item_name-item_type"] == "collection"
        #     else
        #         DataObject,

        # )
        page = request.values.get("page", 1, int)
        limit = 20  # request.values.get("per_page", 20, int)
        offset = (page - 1) * limit
        pprint(request.values)
        current_app.logger.info(f"Query with offset {offset}, limit {limit}")

        query = (
            Query(g.irods_session, *objects)
            .filter(*filters)
            .limit(limit)
            .offset(offset)
        )

        if True:  # "page" not in request.values or not request.values["total"]:
            total_query_object = (
                Collection.id
                if request.values["item_name-item_type"] == "collection"
                else DataObject.id
            )
            filters = filters.copy()
            total_query = (
                Query(g.irods_session, total_query_object)
                .filter(*filters)
                .count(total_query_object)
            )
            total_results = total_query.execute()
            print(f"totals:")
            print(total_results)
            for r in total_results:
                print(f"TOTAL = {r[total_query_object]}")
            print("end totals")
            total = int(total_results[0][total_query_object])
            # if request.values["item_name-item_type"] == "data_object":
            #     total = int(total / 2)
            current_app.logger.info(f" total results is {total}")
            # rebuild the search form
            # search_form = CatalogSearchForm(
            #     formdata=request.values, per_page=20, total=total
            # )

        else:
            total = int(request.values["total"])
            current_app.logger.info(f"Re-using the request total parameter: {total}")

        current_app.logger.info(f"Assigned to total hidden field: {total}")
        search_form.total.data = total
        pprint(search_form.total)

        # pprint(query)

        # search_query.limit = 20
        # search_query.offset = 0

        # pprint(query._message())
        try:
            results = query.execute()
        except Exception as error:
            print(f"Error during search", error)
            flash(f"The server returned an error: {error}", category="danger")
            return render_template(
                "basic_catalog_search.html.j2",
                search_form=search_form,
                # collection_tree=collection_tree,
                results=[],
            )

        end = time.time()  # right time
        dict_results = []
        for r in results:
            if request.values["item_name-item_type"] == "collection":
                dict_results.append(
                    {
                        "type": "collection",
                        "name": r[Collection.name],
                        "owner": r[Collection.owner_name],
                    }
                )
            else:
                dict_results.append(
                    {
                        "type": "data_object",
                        "path": r[Collection.name],
                        "name": r[DataObject.name],
                        "size": r[DataObject.size],
                        "owner": r[DataObject.owner_name],
                    }
                )
        # pprint(dict_results)
        pagination = Pagination(
            page=page,
            per_page=limit,
            total=total,
            # search=True,
            record_name="items",
            css_framework="bootstrap5",
            # show_single_page=True,
        )
        # pprint(pagination)

        return render_template(
            "basic_catalog_search.html.j2",
            search_form=search_form,
            results=results,
            total=total,
            dict_results=dict_results,
            # collection_tree=collection_tree,
            search_time=end - start,
            meta_names=meta_names,
            pagination=pagination,
        )

    else:

        return render_template(
            "basic_catalog_search.html.j2",
            search_form=search_form,
            results=[],
            meta_names=meta_names,
            # collection_tree=collection_tree,
        )
