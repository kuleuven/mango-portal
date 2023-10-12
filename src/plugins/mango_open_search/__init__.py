import os
from opensearchpy import OpenSearch, helpers
from irods.session import iRODSSession
from irods.collection import iRODSCollection
from irods.data_object import iRODSDataObject
from slugify import slugify
import os
import requests
import irods_zones_config
from threading import Lock, Thread, Event
import datetime, time, logging
from lib import util
import signals
from flask import current_app
import multidict
import traceback

mango_prefix = ""  #

from app import app

with app.app_context():
    mango_prefix = current_app.config["MANGO_SCHEMA_PREFIX"] + "."


API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not API_TOKEN:
    logging.warn(f"No COZ API token, module opensearch will not work")

MANGO_OPEN_SEARCH_HOST = os.environ.get("MANGO_OPEN_SEARCH_HOST", "localhost")
MANGO_OPEN_SEARCH_HOST_QUERY = os.environ.get(
    "MANGO_OPEN_SEARCH_HOST_QUERY", MANGO_OPEN_SEARCH_HOST
)
MANGO_OPEN_SEARCH_HOST_INGEST = os.environ.get(
    "MANGO_OPEN_SEARCH_HOST_INGEST", MANGO_OPEN_SEARCH_HOST_QUERY
)
MANGO_HOSTNAME = os.environ.get("HOSTNAME", "unknown")

MANGO_OPEN_SEARCH_PORT = os.environ.get("MANGO_OPEN_SEARCH_PORT", 9200)
MANGO_OPEN_SEARCH_USER = os.environ.get("MANGO_OPEN_SEARCH_USER", "admin")
MANGO_OPEN_SEARCH_PASSWORD = os.environ.get("MANGO_OPEN_SEARCH_PASSWORD", "admin")
MANGO_OPEN_SEARCH_INDEX_NAME = os.environ.get(
    "MANGO_OPEN_SEARCH_INDEX_NAME", "irods-global"
)

MANGO_OPEN_SEARCH_AUTH = (MANGO_OPEN_SEARCH_USER, MANGO_OPEN_SEARCH_PASSWORD)
MANGO_INDEX_THREAD_SLEEP_TIME = 2
MANGO_INDEX_THREAD_HEARTBEAT_DELTA = 300
MANGO_OPEN_SEARCH_SESSION_REFRESH_DELTA = 3600

# For now a single client
# @todo: create a pool (object) of clients to use by multiple threads
mango_open_search_client = OpenSearch(
    hosts=[{"host": MANGO_OPEN_SEARCH_HOST_QUERY, "port": MANGO_OPEN_SEARCH_PORT}],
    http_compress=False,  # enables gzip compression for request bodies
    http_auth=MANGO_OPEN_SEARCH_AUTH,
    # client_cert = client_cert_path,
    # client_key = client_key_path,
    use_ssl=True,
    verify_certs=False,
    ssl_assert_hostname=False,
    ssl_show_warn=False,
    # ca_certs = ca_certs_path
)

# create a dedicated open search index client for this node
mango_open_search_client_ingest = OpenSearch(
    hosts=[{"host": MANGO_OPEN_SEARCH_HOST_INGEST, "port": MANGO_OPEN_SEARCH_PORT}],
    http_compress=False,  # enables gzip compression for request bodies
    http_auth=MANGO_OPEN_SEARCH_AUTH,
    # client_cert = client_cert_path,
    # client_key = client_key_path,
    use_ssl=True,
    verify_certs=False,
    ssl_assert_hostname=False,
    ssl_show_warn=False,
    # ca_certs = ca_certs_path
)


def get_index_session_params_via_api(zone: str):
    if not API_URL or not API_TOKEN or not zone in irods_zones_config.irods_zones:
        return False
    jobid = irods_zones_config.irods_zones[zone]["jobid"]
    # /irods/zones/{id}/admin_token
    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.post(
        f"{API_URL}/v1/irods/zones/{jobid}/admin_token", headers=header
    )
    response.raise_for_status()
    return response.json()


index_queue = []

ALLOWED_JOB_TYPES = ["index_item", "index_subtree", "delete_item", "delete_subtree"]


def add_index_job(zone: str, job_type: str, item_path: str, item_type: str, item_id=0):
    """
    type can be 'index_item', 'index_subtree', 'delete_item', 'delete_subtree'
    """
    global index_queue
    index_queue.append(
        {
            "zone": zone,
            "job_type": job_type,
            "item_path": item_path,
            "item_type": item_type,
            "time": datetime.datetime.now(),
            "item_id": item_id,
        }
    )


zone_index_sessions = {}

import plugins.operator as irods_operator


def get_zone_index_session(zone: str):
    return irods_operator.get_zone_operator_session(zone)


def get_open_search_client(type="query", refresh=False):
    # to be changed to a pooled version when running multiple threads
    global mango_open_search_client
    global mango_open_search_client_ingest

    if refresh:
        mango_open_search_client = OpenSearch(
            hosts=[
                {"host": MANGO_OPEN_SEARCH_HOST_QUERY, "port": MANGO_OPEN_SEARCH_PORT}
            ],
            http_compress=False,  # enables gzip compression for request bodies
            http_auth=MANGO_OPEN_SEARCH_AUTH,
            # client_cert = client_cert_path,
            # client_key = client_key_path,
            use_ssl=True,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False,
            # ca_certs = ca_certs_path
        )

        # create a dedicated open search index client for this node
        mango_open_search_client_ingest = OpenSearch(
            hosts=[
                {"host": MANGO_OPEN_SEARCH_HOST_INGEST, "port": MANGO_OPEN_SEARCH_PORT}
            ],
            http_compress=False,  # enables gzip compression for request bodies
            http_auth=MANGO_OPEN_SEARCH_AUTH,
            # client_cert = client_cert_path,
            # client_key = client_key_path,
            use_ssl=True,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False,
            # ca_certs = ca_certs_path
        )

    if type == "ingest":
        return mango_open_search_client_ingest
    return mango_open_search_client


def ping_open_search_servers():
    return {
        "query": get_open_search_client("query").ping(),
        "ingest": get_open_search_client("ingest").ping(),
    }


def check_mapping_for_avu_name(avu_name):
    # currently no special mapping
    # returns the mapping type or False
    # TODO
    return False


def update_mapping_schema():
    
    mappings = {
        "properties": {
            "mango_noschema_flat_fields": {"type": "flat_object"},
            "mango_schema_flat_fields": {"type": "flat_object"},
            "mango_flat_fields": {"type": "flat_object"},
            "mango_descriptive_text_basket": {"type": "text"},
            "mango_suggestions_basket": {"type": "completion"},
            "irods_item_type": {"type": "keyword"},
            "irods_item_type_simple": {"type": "keyword"},
            "irods_parent_paths": {"type": "keyword"},
            "irods_path": {"type": "keyword"},
            "irods_zone_name": {"type": "keyword"},
            "irods_item_type": {"type": "keyword"},
            "irods_owner_name": {"type": "keyword"},
            "irods_owner_zone": {"type": "keyword"},
            "irods_parent_path": {"type": "keyword"},
            "irods_name": {"type": "keyword"},
            "irods_created": {"type": "date"},
            "irods_modified": {"type": "date"},
        }
    }

    response = get_open_search_client("ingest").indices.put_mapping(
        index=MANGO_OPEN_SEARCH_INDEX_NAME, body=mappings
    )

    return response


# simple caching strategy
path_ids = {}


def get_path_id(irods_session: iRODSSession, path: str):
    """
    Important for the path variable, we expect a leading forward slash starting with the zone name
    No checking done for performance
    """
    global path_ids
    if not path in path_ids:
        try:
            collection: iRODSCollection = irods_session.collections.get(path)
            path_ids[path] = collection.id
        except Exception:
            return False
    return path_ids[path]


def get_open_search_doc_id(
    zone: str,
    item_type: str,
    item_id: int,
):
    return f"{zone}_{item_type}_{item_id}"

def aggregate_descriptive_field_values(fields: dict, mango_descriptive_text_basket: list) -> None:

    def add_text(value_or_values):
        if type(value_or_values) is list:
            mango_descriptive_text_basket.extend(value_or_values)
        else:
            mango_descriptive_text_basket.append(value_or_values)

    white_listed_fields = ["irods_name"]
    black_listed_prefix = ("irods_", "mango_descriptive_text_basket")
    match_text_partials = ["name", "title", "description", "comment", "summary"]
    
    for field_name in fields.keys():
        if field_name in white_listed_fields:
            add_text(fields[field_name])
        if field_name.startswith(black_listed_prefix):
            continue
        field_name_lower = field_name.lower()
        for partial in match_text_partials:
            if partial in field_name_lower:
                add_text(fields[field_name])
                    

def get_basic_index_doc_for_item(
    irods_session: iRODSSession, item: iRODSCollection | iRODSDataObject, **options
):
    """ """

    def get_no_schema_name(name):
        # return "mango_flat_field." + slugify(avu.name, separator="__")
        return slugify(avu.name, separator="__")
    
    def unflatten_namespace_into_dict(
        target_dict: dict, namespaced_string: str, value=None
    ) -> dict:
        if "." in namespaced_string:
            lead_key, rest = namespaced_string.split(".", 1)
            if lead_key not in target_dict:
                target_dict[lead_key] = {}
            unflatten_namespace_into_dict(target_dict[lead_key], rest, value)
        else:
            target_dict[namespaced_string] = value

    fields = {}
    fields["mango_descriptive_text_basket"] = []

    # avu fields can be multivalued
    md_flat_fields = multidict.MultiDict()  # mg. special fields collection
    md_schema_flat_fields = multidict.MultiDict()  # schema fields collections
    md_noschema_flat_fields = multidict.MultiDict()  # everything else
    

    # field_mappings = {}
    metadata_counts = {"schema": 0, "mango": 0, "other": 0}
    metadata = item.metadata.items()
    for avu in metadata:
        if avu.name.startswith((mango_prefix, "mg.")):
            if avu.name.startswith("mg."):
                md_flat_fields.add(avu.name, avu.value)
                metadata_counts["mango"] += 1
            else:
                md_schema_flat_fields.add(avu.name, avu.value)
                metadata_counts["schema"] += 1
        else:
            normalised_field_name = get_no_schema_name(avu.name)
            md_noschema_flat_fields.add(f"{normalised_field_name}", avu.value)
            # field_mappings[os_field_name] = avu.name
            if avu.units:
                md_noschema_flat_fields.add(f"{normalised_field_name}_units", avu.units)
            metadata_counts["other"] += 1
    # for flattened objects, the field needs to be an object (mapped from Python dict)
    all_flat_fields = {
        "mango_flat_fields": md_flat_fields,
        "mango_schema_flat_fields": md_schema_flat_fields,
        "mango_noschema_flat_fields": md_noschema_flat_fields,
    }
    for (field_name_prefix, ff_md) in all_flat_fields.items():
        if len(ff_md) > 0:
            fields[field_name_prefix] = {}
            for key in set(ff_md.keys()):
                values = ff_md.getall(key)
                value = values if len(values) > 1 else values[0]
                aggregate_descriptive_field_values({key: value}, fields["mango_descriptive_text_basket"])
                unflatten_namespace_into_dict(fields[field_name_prefix], key, value)

    if metadata_counts["schema"]:
        fields["irods_metadata_count_schema"] = metadata_counts["schema"]
    if metadata_counts["mango"]:
        fields["irods_metadata_count_mango"] = metadata_counts["mango"]
    if metadata_counts["other"]:
        fields["irods_metadata_count_other"] = metadata_counts["other"]

    fields["irods_zone_name"] = irods_session.zone
    fields["irods_item_type"] = item.__class__.__name__.lower()
    fields["irods_item_type_simple"] = "c" if isinstance(item, iRODSCollection) else "d"
    if isinstance(item, iRODSDataObject):
        fields["size"] = item.size
    # To be changed with PRC release >= 1.1.6
    acl_users = []
    _permissions = irods_session.permissions.get(
        item, report_raw_acls=True, acl_users=acl_users
    )
    acl_read_users = []
    acl_read_groups = []

    for acl_user in acl_users:
        if acl_user.type in ["rodsuser", "rodsadmin"]:
            acl_read_users += [acl_user.id]
        if acl_user.type in ["rodsgroup"]:
            acl_read_groups += [acl_user.id]
    if acl_read_users:
        fields["irods_acl_read_users"] = acl_read_users
    if acl_read_groups:
        fields["irods_acl_read_groups"] = acl_read_groups
    fields["irods_path"] = item.path
    fields["irods_name"] = item.name
    fields["irods_created"] = item.create_time
    fields["irods_modified"] = item.modify_time
    fields["irods_owner_name"] = item.owner_name
    fields["irods_owner_zone"] = item.owner_zone
    fields["irods_id"] = item.id

    parent_collection_path = (
        item.collection.path
        if isinstance(item, iRODSDataObject)
        else os.path.dirname(item.path)
    )
    # print(f"Parent path: {parent_collection_path}")
    parent_collection_path_ids = []
    parent_collection_paths = []
    parent_collection_path_elements = parent_collection_path.lstrip("/").split("/")
    # print(f"{parent_collection_path_elements}")
    fields["irods_parent_path"] = parent_collection_path

    for path_element in reversed(parent_collection_path_elements.copy()):
        # print(f"Path element: {path_element}")
        if path_element and (
            id := get_path_id(
                irods_session,
                parent_collection_iteration_path := f"/{'/'.join(parent_collection_path_elements)}",
            )
        ):
            parent_collection_path_ids += [id]
            parent_collection_paths += [parent_collection_iteration_path]
            _ = parent_collection_path_elements.pop()
    fields["irods_parent_path_ids"] = parent_collection_path_ids
    fields["irods_parent_paths"] = parent_collection_paths

    fields["_id"] = get_open_search_doc_id(
        zone=fields["irods_zone_name"],
        item_type=fields["irods_item_type_simple"],
        item_id=fields["irods_id"],
    )
    fields["mango_descriptive_text_basket"].extend([item.name])
    fields["mango_suggestions_basket"] = fields["mango_descriptive_text_basket"]

    return fields

def generate_docs_for_children(
    irods_session: iRODSSession, collection: iRODSCollection, action="index"
):
    docs = []
    # logging.info(f"Starting, requesting subcollections")
    for sub_collection in collection.subcollections:
        logging.info(f"generating doc for collection {sub_collection.path}")
        fields = {}
        try:
            fields = get_basic_index_doc_for_item(irods_session, sub_collection)

            fields["index_timestamp"] = time.time()
            fields["_index"] = MANGO_OPEN_SEARCH_INDEX_NAME
            fields["_op_type"] = action
            docs.append(fields)
        except Exception as e:
            logging.warn(
                f"Failed getting doc for collection {sub_collection.path}, skipping this one: {e}"
            )
            logging.warn(traceback.format_exc())

    # logging.info(f"Done generating docs for collections, requesting data objects now")
    for data_object in collection.data_objects:
        logging.info(f"generating doc for data object {data_object.path}")
        fields = {}
        try:
            fields = get_basic_index_doc_for_item(irods_session, data_object)
            fields["index_timestamp"] = time.time()
            fields["_index"] = MANGO_OPEN_SEARCH_INDEX_NAME
            fields["_op_type"] = "index"
            docs.append(fields)
        except Exception as e:
            logging.warn(
                f"Failed getting doc fields for data object {data_object.path}, skipping this one: {e}"
            )
            logging.warn(traceback.format_exc())
            pass
    return docs


def index_item(irods_session: iRODSSession, item_type: str, item_path: str):
    # normalize item_path
    if not irods_session:
        logging.warn(
            f"Failed indexing {item_type} {item_path}: no valid indexing session"
        )
        return None

    if not item_type in ["collection", "data_object"]:
        return None
    if not item_path.startswith("/"):
        item_path = f"/{item_path}"
    try:
        if item_type == "collection":
            item = irods_session.collections.get(item_path)
        if item_type == "data_object":
            item = irods_session.data_objects.get(item_path)

        fields = get_basic_index_doc_for_item(irods_session, item)
        id = fields.pop("_id")
        response = get_open_search_client(type="ingest").index(
            MANGO_OPEN_SEARCH_INDEX_NAME, fields, id=id, refresh=True
        )
        return response

    except Exception as e:
        logging.warn(f"Failed indexing {item_type} {item_path}: {e}")
        return None


def index_children(
    irods_session: iRODSSession, collection_path: str, schedule_sub_collections=True
):
    if not irods_session:
        logging.warn(
            f"Failed indexing children of {collection_path}: no valid indexing session"
        )
        return None
    try:
        collection = irods_session.collections.get(collection_path)
        logging.info(
            f"Got collection from {collection_path}, now bulk indexing: looping of collection children and generating docs"
        )
        actions = generate_docs_for_children(irods_session, collection, action="index")
        # logging.info(f"Allright, bulk actions now")
        response = helpers.bulk(get_open_search_client(type="ingest"), actions)

        if schedule_sub_collections:
            # logging.info(f"Adding children collections for next level subtree indexing")
            for sub_collection in collection.subcollections:
                add_index_job(
                    zone=irods_session.zone,
                    job_type="index_subtree",
                    item_path=sub_collection.path,
                    item_type="collection",
                )

        return response
    except Exception as e:
        logging.warn(f"Failed indexing children of {collection_path}: {e}")
        return False


def delete_item(zone: str, item_id: int, item_type: str):
    id = get_open_search_doc_id(zone=zone, item_type=item_type, item_id=item_id)
    response = get_open_search_client(type="ingest").delete(
        index=MANGO_OPEN_SEARCH_INDEX_NAME, id=id
    )
    return response


def delete_item_by_path(zone: str, item_path):
    query_body = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "irods_path.keyword": item_path,
                        }
                    },
                    {"term": {"irods_zone_name": zone}},
                ]
            }
        }
    }
    response = get_open_search_client(type="ingest").delete_by_query(
        index=MANGO_OPEN_SEARCH_INDEX_NAME, body=query_body
    )
    return response


def delete_subtree_by_id(zone: str, path_item_id: int):
    query_body = {
        "query": {
            "bool": {
                "filter": [
                    {
                        "bool": {
                            "should": [
                                {"term": {"irods_parent_path_ids": path_item_id}},
                                {"term": {"irods_id": path_item_id}},
                            ]
                        },
                    },
                    {"term": {"irods_zone_name.keyword": zone}},
                ]
            }
        }
    }

    delete_item(zone=zone, item_id=path_item_id, item_type="collection")
    response = get_open_search_client(type="ingest").delete_by_query(
        index=MANGO_OPEN_SEARCH_INDEX_NAME, body=query_body
    )
    return response


def delete_subtree_by_path(zone: str, item_path):
    query_body = {
        "query": {
            "bool": {
                "filter": [
                    {
                        "bool": {
                            "should": [
                                {"term": {"irods_parent_paths.keyword": item_path}},
                                {"term": {"irods_path.keyword": item_path}},
                            ]
                        }
                    },
                    {"term": {"irods_zone_name.keyword": zone}},
                ]
            }
        }
    }

    response = get_open_search_client(type="ingest").delete_by_query(
        index=MANGO_OPEN_SEARCH_INDEX_NAME, body=query_body
    )
    return response


def delete_all():
    
    response = get_open_search_client(type="ingest").indices.delete(
        index=MANGO_OPEN_SEARCH_INDEX_NAME
    )
    logging.warning("deleted index entirely")
    #print(response) # {'acknowledged': True}
    response = get_open_search_client(type="ingest").indices.create(
        index=MANGO_OPEN_SEARCH_INDEX_NAME
    )
    logging.warning("Recreated empty index")
    #print(response) # {'acknowledged': True}
    mapping_result = update_mapping_schema()
    logging.info("Updating mapping for opensearch index")
    #print(mapping_result)  # {'acknowledged': True}
    return response


def execute_index_job(zone: str, job_type: str, item_type, item_path, item_id, time):
    if not job_type in ALLOWED_JOB_TYPES:
        return
    _ = time  # not used, but present in the **parameter expansion calling this function

    irods_session_for_zone = get_zone_index_session(zone)
    if not irods_session_for_zone:
        if not API_TOKEN:
            logging.warn(
                f"Cannot index, no valid API_TOKEN, aborting and removing job for node {MANGO_HOSTNAME}"
            )
        else:
            logging.warn(
                f"Cannot index, no valid irods indexing session, aborting, but adding job again to the queue for node {MANGO_HOSTNAME}"
            )
            add_index_job(
                zone=zone,
                job_type=job_type,
                item_type=item_type,
                item_path=item_path,
                item_id=item_id,
            )
            return
    if job_type == "index_item":
        result = index_item(irods_session_for_zone, item_type, item_path)
    if job_type == "index_subtree" and item_type == "collection":
        result = index_children(
            irods_session_for_zone, item_path, schedule_sub_collections=True
        )
    if job_type == "delete_item":
        result = delete_item_by_path(zone=zone, item_path=item_path)
    if job_type == "delete_subtree":
        result = delete_subtree_by_path(zone=zone, item_path=item_path)


def collection_modified_listener(sender, **parameters):
    if not ("collection_path" in parameters) or not ("irods_session" in parameters):
        return
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="collection",
        item_path=parameters["collection_path"],
    )


def data_object_modified_listener(sender, **parameters):
    if not ("data_object_path" in parameters) or not ("irods_session" in parameters):
        return
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="data_object",
        item_path=parameters["data_object_path"],
    )


def collection_deleted_listener(sender, **parameters):
    if not ("collection_path" in parameters) or not ("irods_session" in parameters):
        return
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="delete_subtree",
        item_type="collection",
        item_path=parameters["collection_path"],
    )


def data_object_deleted_listener(sender, **parameters):
    if not ("data_object_path" in parameters) or not ("irods_session" in parameters):
        return
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="delete_item",
        item_type="data_object",
        item_path=parameters["data_object_path"],
    )


def subtree_added_listener(sender, **parameters):
    if not ("collection_path" in parameters) or not ("irods_session" in parameters):
        return
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="collection",
        item_path=parameters["collection_path"],
    )
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_subtree",
        item_type="collection",
        item_path=parameters["collection_path"],
    )


def permissions_changed_listener(sender, **parameters):
    if not ("item_path" in parameters) or not ("irods_session" in parameters):
        return
    if "recursive" in parameters and parameters["recursive"]:
        # it must be a collection for recursive to be true
        add_index_job(
            zone=parameters["irods_session"].zone,
            job_type="index_item",
            item_type="collection",
            item_path=parameters["item_path"],
        )
        add_index_job(
            zone=parameters["irods_session"].zone,
            job_type="index_subtree",
            item_type="collection",
            item_path=parameters["item_path"],
        )
        return
    item_type = util.get_type_for_path(
        parameters["irods_session"], parameters["item_path"]
    )

    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type=item_type,
        item_path=parameters["item_path"],
    )


def data_object_moved_listener(sender, **parameters):
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="delete_item",
        item_type="data_object",
        item_path=parameters["original_path"],
    )
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="data_object",
        item_path=parameters["new_path"],
    )


def collection_moved_listener(sender, **parameters):
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="delete_subtree",
        item_type="collection",
        item_path=parameters["original_path"],
    )
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="collection",
        item_path=parameters["new_path"],
    )
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_subtree",
        item_type="collection",
        item_path=parameters["new_path"],
    )


def data_object_copied_listener(sender, **parameters):
    add_index_job(
        zone=parameters["irods_session"].zone,
        job_type="index_item",
        item_type="data_object",
        item_path=parameters["new_path"],
    )


signals.collection_added.connect(collection_modified_listener)
signals.collection_changed.connect(collection_modified_listener)
signals.collection_deleted.connect(collection_deleted_listener)
signals.collection_trashed.connect(collection_deleted_listener)
signals.collection_moved.connect(collection_moved_listener)
signals.collection_renamed.connect(collection_moved_listener)
signals.subtree_added.connect(subtree_added_listener)

signals.data_object_added.connect(data_object_modified_listener)
signals.data_object_changed.connect(data_object_modified_listener)
signals.data_object_deleted.connect(data_object_deleted_listener)
signals.data_object_trashed.connect(data_object_deleted_listener)
signals.data_object_moved.connect(data_object_moved_listener)
signals.data_object_renamed.connect(data_object_moved_listener)
signals.data_object_copied.connect(data_object_copied_listener)

signals.permissions_changed.connect(permissions_changed_listener)

# signals.collection_moved

# Indexing thread :)


class IndexingThread(Thread):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop = Event()
        self.daemon = True
        self.start_time = datetime.datetime.now()
        self.heartbeat_time = time.time()
        self.open_search_session_refresh_time = time.time()
        logging.info(f"Indexing thread created")
        self.status = "active"

    def stop(self):
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

    def set_status(self, status="sleep"):
        self.status = status

    def run(self):
        global index_queue
        while True:
            # stop doing anything if we are stopped (externally)
            if self.stopped():
                logging.info(
                    f"Sorry, I ({MANGO_HOSTNAME} indexing thread) am stopped, ask Paul to redeploy"
                )
                break

            current_time = datetime.datetime.now()

            if ((queue_length := len(index_queue)) > 0) and self.status == "active":
                logging.info(
                    f"Indexing {index_queue[0]} from {queue_length} outstanding jobs on {MANGO_HOSTNAME}"
                )
                current_job = index_queue[0].copy()
                try:
                    execute_index_job(**index_queue.pop(0))
                except Exception as e:
                    logging.warn(
                        f"Failed indexing {e}, not adding job to the queue again"
                    )
                    # index_queue += [current_job]

            if self.status == "sleep":
                logging.info(f"Indexing thread in sleep mode on {MANGO_HOSTNAME}")
                pass
            if self.status == "flush":
                logging.info(f"Flushing index jobs on {MANGO_HOSTNAME}")
                index_queue.clear()

            if self.status == "flush_sleep":
                index_queue.clear()
                self.set_status("sleep")
                logging.info(f"Flushing index jobs and sleep on {MANGO_HOSTNAME}")

            if self.status == "flush_active":
                index_queue.clear()
                self.set_status("active")
                logging.info(f"Flushing index jobs and activate on {MANGO_HOSTNAME}")

            time.sleep(MANGO_INDEX_THREAD_SLEEP_TIME)
            # logging.info(f"Awakening sleeping index thread")

            if (
                time.time() - self.open_search_session_refresh_time
                > MANGO_OPEN_SEARCH_SESSION_REFRESH_DELTA
            ):
                get_open_search_client(refresh=True)
                self.open_search_session_refresh_time = time.time()
                logging.info(
                    f"Refreshed open search server client connections on {MANGO_HOSTNAME}"
                )
            # emit a heartbeat logging at most every 300 seconds
            if time.time() - self.heartbeat_time > MANGO_INDEX_THREAD_HEARTBEAT_DELTA:
                # reset the heartbeat reference time point
                self.heartbeat_time = time.time()
                logging.info(f"Indexing thread heartbeat on {MANGO_HOSTNAME}")


# debug start indexing hard coded path
# add_index_job(zone = 'kuleuven_tier1_pilot', job_type='subtree', item_path='/kuleuven_tier1_pilot/home/vsc33436', item_type='collection')

indexing_thread = IndexingThread()
indexing_thread.start()


# except Exception:
#     print(f"Failed index_children")
#     return None
