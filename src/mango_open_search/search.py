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
)

from mango_open_search import (
    add_index_job,
    get_open_search_client,
    MANGO_OPEN_SEARCH_INDEX_NAME,
)
from opensearchpy import client


mango_open_search_bp = Blueprint(
    "mango_open_search_bp", __name__, template_folder="templates"
)


@mango_open_search_bp.route("/open-search/index-subtree", methods=["POST"])
def index_collection():
    collection_path = request.form["collection_path"]
    if not collection_path.startswith("/"):
        collection_path = f"/{collection_path}"
    if "zone" in request.form:
        zone = request.form["collection_path"]
    else:
        zone = collection_path.split("/")[1]

    add_index_job(
        zone=zone, job_type="item", item_path=collection_path, item_type="collection"
    )
    add_index_job(
        zone=zone, job_type="subtree", item_path=collection_path, item_type="collection"
    )


@mango_open_search_bp.route("/open-search/search", methods=["GET"])
def zone_search():
    mango_osc: client = get_open_search_client()
    if not mango_osc.ping():
        abort(500, "Search server is not running or reachable")

    search_results = []
    search_string = ""
    if "search_string" in request.values and request.values["search_string"]:
        search_string = request.values["search_string"]
        search_results = mango_osc.search(
            {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": request.values["search_string"],
                                    "fields": ["match_all"],
                                }
                            },
                            {
                                "bool": {
                                    "filter": [
                                        {
                                            "term": {
                                                "irods_zone_name": g.irods_session.zone
                                            }
                                        },
                                        {
                                            "bool": {
                                                "should": [
                                                    {
                                                        "term": {
                                                            "acl_read_users": g.irods_session.user.id
                                                        }
                                                    }
                                                ]
                                                + [
                                                    {
                                                        "term": {
                                                            "acl_read_groups": group_id
                                                        }
                                                    }
                                                    for group_id in g.irods_session.group_ids
                                                ]
                                            }
                                        },
                                    ]
                                }
                            },
                        ]
                    }
                },
                "size": 20,
                "highlight": {"fields": {"match_all": {}}},
            },
            index=MANGO_OPEN_SEARCH_INDEX_NAME,
        )

    view_template = "mango_open_search/search_results.html.j2"
    return render_template(
        view_template, search_results=search_results, search_string=search_string
    )
