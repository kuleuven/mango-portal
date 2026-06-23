from flask import (
    Blueprint,
    render_template,
    current_app,
    g,
    request,
    flash,
)


from .search_form import CatalogSearchForm

from irods.models import (
    Collection,
    DataObject,
    DataObjectMeta,
    CollectionMeta,
)
from irods.query import Query
from irods.column import Criterion, Like
from irods.session import iRODSSession
from datetime import datetime
from flask_paginate import Pagination
from ..template_overrides import get_template_override_manager
from ..metadata_schema.editor import get_realms_for_current_user
import time

from mango_ui import register_module

from . import (
    admin,
)  # to register the admin route without configuring another blueprint, is there a better way to do this?

basic_search_bp = Blueprint("basic_search_bp", __name__, template_folder="templates")

ITEM_TYPE = "item_name-item_type"  # data_object or collection


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


# ---------------------- filters ---------------------------- #


def get_criterion(user_input: str, column) -> Criterion:
    comparison = "like" if user_input.find("%") != -1 else "="
    return Criterion(comparison, column, user_input)


def build_basic_query_filters(form):
    filters = []

    # constant form keys
    ITEM_NAME = "item_name-item_name"
    ITEM_NAME_FULL_MATCH = "item_name-comparison"  # y or n
    METADATA_SCHEMA_PREFIX = "schema_metadata-"
    METADATA_NOSCHEMA_PREFIX = "non_schema_metadata-"
    SUBTREE = "collection_subtree-collection"

    # subtree
    if subtree := form.get(SUBTREE, None):
        filters += [Like(Collection.name, f"{subtree}%")]
    else:
        raise KeyError("Compulsory subtree is missing.")

    # deal with item type
    if form[ITEM_TYPE] == "data_object":
        item_column = DataObject
        metadata_item_column = DataObjectMeta
        filters += [Criterion("=", DataObject.replica_number, 0)]
    else:
        item_column = Collection
        metadata_item_column = CollectionMeta

    # deal with item name
    if item_name := form.get(ITEM_NAME, None):
        item_name = item_name.strip()
        crit = "=" if form.get(ITEM_NAME_FULL_MATCH, None) == "y" else "like"
        item_name = f"%{item_name}%" if crit == "like" else item_name
        filters += [Criterion(crit, item_column.name, item_name)]

    # deal with schema metadata

    schema_attributes = [
        key
        for key in form.keys()
        if key.startswith(METADATA_SCHEMA_PREFIX) and key.endswith("meta_a")
    ]
    for attribute in schema_attributes:
        filters += [get_criterion(form[attribute], metadata_item_column.name)]
        if schema_value := form.get(attribute.replace("_a", "_v"), False):
            filters += [get_criterion(schema_value, metadata_item_column.value)]

    # deal with non-schema metadata

    METADATA_SUFFIX_PART_MAPPING = {
        "a": metadata_item_column.name,
        "v": metadata_item_column.value,
        "u": metadata_item_column.units,
    }

    non_schema_indices = set(
        [
            key.split("-")[1]
            for key in form.keys()
            if key.startswith(METADATA_NOSCHEMA_PREFIX)
        ]
    )
    for idx in non_schema_indices:  # loop over existing indices
        for (
            suffix,
            avu_part,
        ) in METADATA_SUFFIX_PART_MAPPING.items():  # loop over name/value/unit
            if form_value := form.get(
                f"{METADATA_NOSCHEMA_PREFIX}{idx}-meta_{suffix}", False
            ):
                filters += [get_criterion(form_value, avu_part)]

    # deal with dates
    DATE_FORM_MAPPING = {
        "create_date": item_column.create_time,
        "mod_date": item_column.modify_time,
    }

    for form_item, column_name in DATE_FORM_MAPPING.items():
        if form_value := form.get(f"{form_item}-date", False):
            comparison = ">=" if form[f"{form_item}-comparison"] == "after" else "<="
            filters += [
                Criterion(comparison, column_name, datetime.fromisoformat(form_value))
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
    # print(label_list)
    return " / ".join(label_list)

    # print("this is the schema:", flattened_schema)

    # return {k : v for k,v in
    #     restructure_item(item, flattened_schema) for item in flattened_schema.items()
    # }


# The class SchemaInfo is is to be copied to __init__.py, no other uses dettected. To remove I guess


def get_realm_schemas_for_user(irods_session: iRODSSession):

    from . import realm_schemas  # avoid circular import

    if hasattr(irods_session, "realm"):
        realm_name = irods_session.realm["name"]
        # if realm_name not in realm_schemas[irods_session.zone]:
        #     update_realm_schemas(irods_session, realm_name)
        return realm_schemas[irods_session.zone].get(realm_name, {})
    else:
        realm_names = get_realms_for_current_user(
            irods_session, f"/{irods_session.zone}/home"
        )
        schemas_for_user = {}
        for realm_name in realm_names:
            # if realm_name not in realm_schemas[irods_session.zone]:
            #     update_realm_schemas(irods_session, realm_name)
            if (
                realm_name in realm_schemas[irods_session.zone]
            ):  # check if the realm schemas are already loaded
                schemas_for_user.update(realm_schemas[irods_session.zone][realm_name])

    return schemas_for_user


@basic_search_bp.route("/catalog/search", methods=["GET", "POST"])
def catalog_search():
    try:
        realm = g.irods_session.realm
    except Exception:
        realm = None

    # print(request.values)
    home = f"/{g.irods_session.zone}/home" if realm is None else realm["path"]

    # update_realm_schemas(g.irods_session, realm["name"] if realm else None)
    user_realm_schemas = get_realm_schemas_for_user(g.irods_session)

    # create a list of first level collections to refine the search

    base = g.irods_session.collections.get(home)
    subtrees = [base.path] + [collection.path for collection in base.subcollections]
    # user_home = f"{g.irods_session.zone}/home/{g.irods_session.username}"

    current_app.logger.info(request.values)

    search_form = CatalogSearchForm(
        formdata=request.values,
        per_page=20,
        schemas=[schema.title for schema in user_realm_schemas.values()],
        subtrees=subtrees,
    )

    if realm is not None:
        search_form.collection_subtree.collection.data = realm["path"]

    # breakpoint()

    # ----------------------- run search -------------------- #

    # print(request.values.to_dict())

    # this dictionary is used to create the fields on page reload
    no_label_fields = list(
        set([k[-8] for k in request.values.to_dict() if "no_label" in k])
    )
    # TODO: make more robust: currently it filters string -8 (-schema, -meta_a, -meta_v) and then removes duplicates by creating a set
    no_label_fields_dict = {f"no_label_{v}": v for v in no_label_fields}

    if not (request.values.get("submit", False) == "Search" and search_form.validate()):
        return render_template(
            "search/basic_catalog_search.html.j2",
            search_form=search_form,
            results=[],
            # collection_tree=collection_tree,
            schemas_dict={k: v.schema for k, v in user_realm_schemas.items()},
            search_fields={},
            no_label_fields_dict={},
        )

    def build_query_columns(values, only_ids=False):
        item_type = Collection if values[ITEM_TYPE] == "collection" else DataObject
        if only_ids:
            return item_type.id
        columns = [Collection.name, Collection.owner_name]
        if item_type == DataObject:
            columns = [
                Collection.name,
                DataObject.name,
                DataObject.size,
                DataObject.owner_name,
            ]
        return columns

    start = time.time()
    filters = build_basic_query_filters(request.values)
    columns = build_query_columns(request.values)

    page = request.values.get("page", 1, int)
    limit = 20  # request.values.get("per_page", 20, int)
    offset = (page - 1) * limit
    current_app.logger.info(f"Query with offset {offset}, limit {limit}")

    query = (
        Query(g.irods_session, *columns).filter(*filters).limit(limit).offset(offset)
    )

    total_query_object = build_query_columns(request.values, True)

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

    current_app.logger.info(f" total results is {total}")

    current_app.logger.info(f"Assigned to total hidden field: {total}")
    search_form.total.data = total

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

    def results_to_dict(result, item_type):
        if item_type == "collection":
            return {
                "type": "collection",
                "name": result[Collection.name],
                "owner": result[Collection.owner_name],
            }
        return {
            "type": "data_object",
            "path": result[Collection.name],
            "name": result[DataObject.name],
            "size": result[DataObject.size],
            "owner": result[DataObject.owner_name],
        }

    dict_results = [
        results_to_dict(result, request.values[ITEM_TYPE]) for result in results
    ]

    pagination = Pagination(
        page=page,
        per_page=limit,
        total=total,
        # search=True,
        record_name="items",
        css_framework="bootstrap5",
        # show_single_page=True,
    )

    for row in search_form.schema_metadata:
        print(row.schema.data)
        if not row.schema.data:
            continue
        row.meta_a.choices = user_realm_schemas[row.schema.data].attributes

    search_template = "search/basic_catalog_search.html.j2"

    if current_collection := request.values.get("collection_subtree-collection", None):
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
        pagination=pagination,
        schemas_dict={k: v.schema for k, v in user_realm_schemas.items()},
        search_fields=request.values.to_dict(),
        no_label_fields_dict=no_label_fields_dict,
    )
