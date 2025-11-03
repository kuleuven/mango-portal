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


def get_criterion(user_input: str, column) -> Criterion:
    comparison = "like" if user_input.find("%") != -1 else "="
    return Criterion(comparison, column, user_input)


def build_basic_query_filters(form):
    filters = []

    # constant form keys
    ITEM_TYPE = "item_name-item_type"  # data_object or collection
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




    # print("this is the schema:", flattened_schema)

    # return {k : v for k,v in
    #     restructure_item(item, flattened_schema) for item in flattened_schema.items()
    # }

class SchemaInfo:
    def __init__(self, realm:str, schema_name:str, schema_dict:dict, schema_manager):
        self._realm = realm
        self._name = schema_name
        self._title = schema_dict.get("title", None)
        # self._schema = transform_schema(self.name, schema_manager)
        self.schema = self.transform_schema(schema_manager) 
    
    @property
    def attributes(self):
        return list(self.schema.keys())
    
    @property
    def title(self):
        return (self.key, self._title)
    
    @property
    def key(self):
        return f"{self._realm}_{self._name}"
    
    def transform_schema(self, schema_manager):
        schema_dict = json.loads(schema_manager.load_schema(self._name))

        flattened_schema = flatten_schema(
            schema_dict,
            level=0,
            prefix=f"mgs.{self._name}",
            result_dict={},
            add_enum=True,
        )
        transformed_schema = {}
        for item in flattened_schema.items():
            transformed_schema |= SchemaInfo.restructure_item(item, flattened_schema)

        return transformed_schema

    @staticmethod
    def restructure_item(item, flattened_schema):
        key, value = item
        restructured_item = {
            key: {
                "type": ("label" if value["type"] == "object" else value["type"]),
                "enum": (value.get("enum", None)),
                "level": value["level"],
                "parent": (
                    None if value["level"] == 0 else ".".join(str(key).split(".")[:-1])
                ),
                "title": (
                    SchemaInfo.create_nested_label(key, flattened_schema)
                    if value["type"] == "object"
                    else value["label"]
                ),  # actual title
                # label with hierarchy for display in select
            }
        }
        return restructured_item


    @staticmethod
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



def get_realm_schemas(realm):

    schema_manager: SchemaManager = get_schema_manager(
        zone=g.irods_session.zone, realm=realm
    )

    my_schemas = schema_manager.list_schemas(
        filters=["published"]
    )  # TODO archived schemas should also be searchable ...

    schema_generator = (SchemaInfo(realm, schema_name, schema_dict, schema_manager) for schema_name, schema_dict in my_schemas.items())

    schemas_dict = {
        schema.key: schema for schema in schema_generator
    }  # transformed schemas dictionary to feed Advanced Search

    return schemas_dict


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
        k: v
        for realm in get_realms_for_current_user(g.irods_session, home)         
        for k, v in get_realm_schemas(realm).items()
    }
    # get_realm_schemas returns a tuple with [0] -> titles and [1] -> transformed schemas


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
        schemas=[schema.title for schema in realm_schemas.values()],
        subtrees=subtrees,
    )

    try:
        # set the choose collection to current realm if exists
        current_realm = g.irods_session.realm
        search_form.collection_subtree.collection.data = current_realm["path"]
    except:
        pass

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
            print(row.schema.data)
            if not row.schema.data:
                continue
            row.meta_a.choices = realm_schemas[row.schema.data].attributes

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
            schemas_dict={k:v.schema for k, v in realm_schemas.items()},
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
            schemas_dict={k:v.schema for k, v in realm_schemas.items()},
            search_fields={},
            no_label_fields_dict={},
        )
