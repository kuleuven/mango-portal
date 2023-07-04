from flask import (
    Blueprint,
    render_template,
    # current_app,
    url_for,
    redirect,
    g,
    # send_file,
    # abort,
    # stream_with_context,
    # Response,
    request,
    # flash,
    # json
)

from plugins.operator import get_zone_operator_session

from . import (
    # add_index_job,
    get_open_search_client,
    MANGO_OPEN_SEARCH_INDEX_NAME,
    get_zone_index_session,
    # index_queue,
    # indexing_thread,
    # MANGO_INDEX_THREAD_SLEEP_TIME,
    # IndexingThread,
    # ping_open_search_servers,
)
from opensearchpy import client
import cache
from irods.collection import iRODSCollection
import logging, time
from mango_ui import register_module_admin

mango_open_search_stats_bp = Blueprint(
    "mango_open_search_stats_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Statistics",
    "bootstrap_icon": "bar-chart-line",
    "description": "Basic collection statistics obtained from the OpenSearch index",
    "blueprint": mango_open_search_stats_bp.name,
}

register_module_admin(**ADMIN_UI)


@mango_open_search_stats_bp.route("/mango-open-search/stats", methods=["GET", "POST"])
def index():
    """"""
    operator_session = get_zone_operator_session(g.irods_session.zone)
    open_search_client = get_open_search_client()

    # @cache.cache.memoize(60)
    def get_index_stats(index_name):
        return open_search_client.indices.stats(index=index_name)

    index_stats = get_index_stats(MANGO_OPEN_SEARCH_INDEX_NAME)
    collection_stats = None

    @cache.cache.memoize(30)
    def get_available_collection_paths(irods_session):
        zone_collection: iRODSCollection = irods_session.collections.get(
            f"/{irods_session.zone}"
        )

        home_collection: iRODSCollection = irods_session.collections.get(
            f"/{irods_session.zone}/home"
        )
        return (
            [f"/{irods_session.zone}"]
            + [c.path for c in zone_collection.subcollections]
            + [c.path for c in home_collection.subcollections]
        )

    @cache.cache.memoize(60)
    def get_stats_for_c_path(c_path: str, c_id: int):
        zone = c_path.split("/")[1]
        query_body = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"irods_parent_path_ids": c_id}},
                        {"term": {"irods_zone_name": zone}},
                    ],
                }
            },
            "aggs": {
                "children_d": {
                    "filter": {"term": {"irods_item_type_simple": "d"}},
                    "aggs": {
                        "data_object_stats_size": {"stats": {"field": "size"}},
                        "data_object_stats_metadata_schema": {
                            "stats": {"field": "irods_metadata_count_schema"}
                        },
                        "data_object_stats_metadata_other": {
                            "stats": {"field": "irods_metadata_count_other"}
                        },
                    },
                },
                "children_d_distribution": {
                    "filter": {"term": {"irods_item_type_simple": "d"}},
                    "aggs": {
                        "data_objects_distribution": {
                            "range": {
                                "field": "size",
                                "ranges": [
                                    {"to": 10**4},
                                    {"from": 10**4, "to": 10**5},
                                    {"from": 10**5, "to": 10**6},
                                    {"from": 10**6, "to": 10**7},
                                    {"from": 10**7, "to": 10**8},
                                    {"from": 10**8, "to": 10**9},
                                    {"from": 10**9, "to": 10**10},
                                    {"from": 10**10, "to": 10**11},
                                    {"from": 10**11, "to": 10**12},
                                    {"from": 10**12},
                                ],
                            }
                        }
                    },
                },
                "children_c": {
                    "filter": {"term": {"irods_item_type_simple": "c"}},
                    "aggs": {
                        "collection_stats": {"value_count": {"field": "irods_id"}},
                        "collection_stats_metadata_schema": {
                            "stats": {"field": "irods_metadata_count_schema"}
                        },
                        "collection_stats_metadata_other": {
                            "stats": {"field": "irods_metadata_count_other"}
                        },
                    },
                },
            },
        }
        result = get_open_search_client(type="query").search(
            body=query_body, index=MANGO_OPEN_SEARCH_INDEX_NAME
        )
        return {
            "num_data_objects": int(
                result["aggregations"]["children_d"]["data_object_stats_size"]["count"]
            ),
            "total_size": int(
                result["aggregations"]["children_d"]["data_object_stats_size"]["sum"]
            ),
            "data_object_max_size": result["aggregations"]["children_d"][
                "data_object_stats_size"
            ]["max"],
            "data_objects_stats": result["aggregations"]["children_d"][
                "data_object_stats_size"
            ],
            "data_objects_dist": result["aggregations"]["children_d_distribution"],
            "collections": result["aggregations"]["children_c"],
            "data_objects": result["aggregations"]["children_d"],
            "num_collections": int(result["aggregations"]["children_c"]["doc_count"]),
        }

    collection_stats = {}
    collection_path = None
    if "collection_path" in request.values:
        collection_path = request.values["collection_path"]
        collection = operator_session.collections.get(collection_path)
        collection_stats[collection_path] = get_stats_for_c_path(
            collection_path, collection.id
        )
        if "show_sub_collections" in request.values:
            for sub_collection in collection.subcollections:
                collection_stats[sub_collection.path] = get_stats_for_c_path(
                    sub_collection.path, sub_collection.id
                )

    return render_template(
        "mango_open_search/stats/admin_stats.html.j2",
        index_stats=index_stats,
        MANGO_OPEN_SEARCH_INDEX_NAME=MANGO_OPEN_SEARCH_INDEX_NAME,
        available_collection_paths=get_available_collection_paths(operator_session),
        collection_stats=collection_stats,
        collection_path=collection_path,
    )
