from flask import (
    Blueprint,
    # render_template,
    # current_app,
    # url_for,
    # redirect,
    g,
    # send_file,
    # abort,
    # stream_with_context,
    # Response,
    # request,
    # flash,
    # json
)

from mango_open_search import (
    # add_index_job,
    get_open_search_client,
    MANGO_OPEN_SEARCH_INDEX_NAME,
    # index_queue,
    # indexing_thread,
    # MANGO_INDEX_THREAD_SLEEP_TIME,
    # IndexingThread,
    # ping_open_search_servers,
)
from opensearchpy import client

from irods.collection import iRODSCollection
import logging, time

mango_open_search_api_bp = Blueprint(
    "mango_open_search_api_bp", __name__, template_folder="templates"
)


@mango_open_search_api_bp.route(
    "/mango-open-search/api/collection-stats/<path:collection_path>"
)
def get_collection_stats(collection_path: str):
    if not collection_path.startswith("/"):
        collection_path = f"/{collection_path}"
    logging.info(f"Requesting stats for sub collection : {collection_path}")
    collection = g.irods_session.collections.get(collection_path)
    # zone = g.irods_session.zone
    query_body = {
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"irods_parent_path_ids": collection.id}},
                    {"term": {"irods_zone_name": g.irods_session.zone}}
                ],
            }
        },
        "aggs": {
            "children_d": {
                "filter": {"term": {"irods_item_type_simple": "d"}},
                "aggs": {"data_object_stats" :
                 {"stats": {"field": "size"}}
                }
            },
            "children_c": {
                "filter": {"term": {"irods_item_type_simple": "c"}},
                "aggs": {"collection_stats" :
                 {"value_count": {"field": "irods_id"}}
                }
            }
        }
    }
    logging.debug(query_body)

    result = get_open_search_client(type="query").search(
        body=query_body, index=MANGO_OPEN_SEARCH_INDEX_NAME
    )
    # dict becomes content type application/json
    return result
