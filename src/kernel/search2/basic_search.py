from flask import (
    Blueprint,
    render_template,
    current_app,
    g,
    request,
    flash,
)
import json
from kernel.search2.search_form import CatalogSearchForm
from cache import cache
from lib.util import (
    flatten_schema,
)
from pprint import pprint
from irods.models import (
    Collection,
    DataObject,
    DataObjectMeta,
    CollectionMeta,
)
from irods.query import Query
from irods.column import Criterion, Like
from datetime import datetime
from flask_paginate import Pagination
from kernel.template_overrides import get_template_override_manager
from kernel.metadata_schema import get_schema_manager  # , SchemaManager
from kernel.metadata_schema.editor import get_realms_for_current_user


basic_search2_bp = Blueprint("basic_search2_bp", __name__, template_folder="templates")

from mango_ui import register_module


UI = {
    "title": "Search",
    "bootstrap_icon": "search",
    "description": "Catalog search",
    "blueprint": basic_search2_bp.name,
    "index": "catalog_search2",
}

register_module(**UI)

irods_comparison_operator = {
    "after": ">=",
    "equal": "=",
    "before": "<=",
    "contains": "like",
}

# hidden_tag = HiddenField()


# ---------------------- filters ---------------------------- #


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
        # crit = "="
        # name = form["item_name-item_name"]
        try:
            if form["item_name-comparison"] == "y":
                crit = "="
                name = form["item_name-item_name"]
        except:
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

    try:
        if form[f"schema_metadata-meta_a"]:
            filters += [
                Criterion("=", column_meta_base.name, form[f"schema_metadata-meta_a"])
            ]

        if form[f"schema_metadata-meta_v"]:
            comparison = (
                "like" if form[f"schema_metadata-meta_v"].find("%") != -1 else "="
            )
            filters += [
                Criterion(
                    comparison, column_meta_base.value, form[f"schema_metadata-meta_v"]
                )
            ]
    except:
        pass

    # for num in [1, 2, 3]:
    num = 0
    while True:
        try:
            if form[f"schema_metadata-{num}-meta_a"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"schema_metadata-{num}-meta_a"],
                    )
                ]

            if form[f"schema_metadata-{num}-meta_v"]:
                comparison = (
                    "like"
                    if form[f"schema_metadata-{num}-meta_v"].find("%") != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"schema_metadata-{num}-meta_v"],
                    )
                ]

            # if form[f"any_avu{num}-meta_u"]:
            #     comparison = "like" if form[f"any_avu{num}-meta_u"].find("%") != -1 else "="
            #     filters += [
            #         Criterion(
            #             comparison, column_meta_base.units, form[f"any_avu{num}-meta_u"]
            #         )
            #     ]
            num += 1
        except:
            break

    num = 0
    while True:
        try:
            if form[f"non_schema_metadata-{num}-meta_a"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"non_schema_metadata-{num}-meta_a"],
                    )
                ]

            if form[f"non_schema_metadata-{num}-meta_v"]:
                comparison = (
                    "like"
                    if form[f"non_schema_metadata-{num}-meta_v"].find("%")
                    != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"non_schema_metadata-{num}-meta_v"],
                    )
                ]

            if form[f"non_schema_metadata-{num}-meta_u"]:
                comparison = (
                    "like"
                    if form[f"non_schema_metadata-{num}-meta_u"].find("%")
                    != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"non_schema_metadata-{num}-meta_u"],
                    )
                ]

                

            num += 1
        except:
            break

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


def create_nested_label(key, flattened_schema):
    parts = key.split(".")
    ids = parts[2:]
    label_list = [
        flattened_schema[".".join(parts[:2] + ids[: i + 1])][
            "label"
        ]  # add +1 here because range starts from 0
        for i in range(len(ids))
    ]
    print(label_list)
    return " / ".join(label_list)


def restructure_item(item, flattened_schema):
    key, value = item
    restructured_item = {
        key: {
            "type": ("label" if value["type"] == "object" else value["type"]),
            "enum": (value.get("enum", None)),
            "level": value["level"],
            "parent": (
                None
                if value["level"] == 0
                else ".".join(str(key).split(".")[:-1])
            ),
            "title": create_nested_label(key, flattened_schema)
                if value["type"] == "object"
                 else value["label"],  # actual title
                     # label with hierarchy for display in select
        }
    }
    return restructured_item


def transform_schema(schema, schema_manager):
    schema_dict = json.loads(schema_manager.load_schema(schema))

    flattened_schema = flatten_schema(
        schema_dict,
        level=0,
        prefix=f"mgs.{schema}",
        result_dict={},
        add_enum=True,
    )

    transformed_schema = {}
    for item in flattened_schema.items():
        transformed_schema |= restructure_item(item, flattened_schema)

    return transformed_schema

    # print("this is the schema:", flattened_schema)

    # return {k : v for k,v in
    #     restructure_item(item, flattened_schema) for item in flattened_schema.items()
    # }


def get_realm_schemas(realm):

    schema_manager: SchemaManager = get_schema_manager(
        zone=g.irods_session.zone, realm=realm
    )

    my_schemas = schema_manager.list_schemas(
        filters=["published"]
    )  # TODO archived schemas should also be searchable ...

    schemas_titles = {
        schema_name: schema["title"] for schema_name, schema in my_schemas.items()
    }
    if not schemas_titles:
        return None

    schemas_dict = {
        k: transform_schema(k, schema_manager) for k in schemas_titles.keys()
    }  # transformed schemas dictionary to feed Advanced Search

    if len(schemas_titles) == 0:
        schemas_titles = {"no_schemas": "no schemas found"}
    return schemas_titles, schemas_dict


@basic_search2_bp.route("/catalog/search2", methods=["GET", "POST"])
def catalog_search2():

    # cache for 5 minutes using all the arguments as a key, user specific!
    @cache.memoize(300)
    def get_meta_attribute_names(type=DataObjectMeta.name, user=None, zone=None):
        current_app.logger.info(
            f"Creating/refreshing metadata attribute (name) cache for user {user}"
        )
        return g.irods_session.query(type).all()

    home = f"/{g.irods_session.zone}/home"
    # allow querying for schemas of any realm the user has access to
    realm_schemas = {
        realm: get_realm_schemas(realm)
        for realm in get_realms_for_current_user(g.irods_session, home)
    }
    # get_realm_schemas returns a tuple with [0] -> titles and [1] -> transformed schemas

    schemas_titles = {
        k: v
        for schema in realm_schemas.values()
        if schema is not None
        for k, v in schema[0].items()
    }
    schemas_transformed = {
        k: v
        for schema in realm_schemas.values()
        if schema is not None
        for k, v in schema[1].items()
    }

    # create a list of first level collections to refine the search

    base = g.irods_session.collections.get(f"/{g.irods_session.zone}/home")
    subtrees = [base.path] + [collection.path for collection in base.subcollections]
    user_home = f"{g.irods_session.zone}/home/{g.irods_session.username}"

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


    search_form = CatalogSearchForm(
        formdata=request.values,
        per_page=20,
        schemas=list(schemas_titles.items()),
        subtrees=subtrees,
    )

    # breakpoint()

    # ----------------------- run search -------------------- #

    print(request.values.to_dict())

    # this dictionary is used to create the fields on page reload
    no_label_fields = list(
        set([k[-8] for k in request.values.to_dict() if "no_label" in k])
    )
    # TODO: make more robust: currently it filters string -8 (-schema, -meta_a, -meta_v) and then removes duplicates by creating a set
    no_label_fields_dict = {f"no_label_{v}": v for v in no_label_fields}

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

        for row in search_form.schema_metadata:
            # no_label_schema = search_form.schema_metadata.schema.data
            # breakpoint()
            print(row.schema.data)
            if row.schema.data == "":
                continue
            if row.schema.data:
                choices_list = [
                    key
                    for key in schemas_transformed[row.schema.data].keys()
                ]
                # choices_list = [choice[1] for choice in choices_tuple]
                row.meta_a.choices = choices_list

        search_template = "search/basic_catalog_search.html.j2"

        if current_collection := request.values.get(
            "collection_subtree-collection", None
        ):
            search_template = get_template_override_manager(
                g.irods_session.zone
            ).get_template_for_catalog_item(
                g.irods_session.collections.get(current_collection),
                "search/basic_catalog_search.html.j2",
            )

        return render_template(
            search_template,
            search_form=search_form,
            results=results,
            total=total,
            dict_results=dict_results,
            # collection_tree=collection_tree,
            search_time=end - start,
            meta_names=meta_names,
            pagination=pagination,
            schemas_dict=schemas_transformed,
            existing_schemas=schemas_titles,
            search_fields=request.values.to_dict(),
            no_label_fields_dict=no_label_fields_dict,
        )

    else:

        return render_template(
            "search/basic_catalog_search.html.j2",
            search_form=search_form,
            results=[],
            meta_names=meta_names,
            # collection_tree=collection_tree,
            schemas_dict=schemas_transformed,
            existing_schemas=schemas_titles,
            search_fields={},
            no_label_fields_dict={},
        )
