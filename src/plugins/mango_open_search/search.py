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

from . import (
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
        # select the second element because the first one is empty
        zone = collection_path.split("/")[1]

    # delete all subtree items from the index below the requested path

    if "skip_reset_collection" not in request.form:
        add_index_job(
            zone=zone,
            job_type="delete_subtree",
            item_path=collection_path,
            item_type="collection",
        )

    add_index_job(
        zone=zone,
        job_type="index_item",
        item_path=collection_path,
        item_type="collection",
    )
    add_index_job(
        zone=zone,
        job_type="index_subtree",
        item_path=collection_path,
        item_type="collection",
    )

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@mango_open_search_bp.route("/open-search/search", methods=["GET"])
def zone_search():
    mango_osc: client = get_open_search_client()
    if not mango_osc.ping():
        abort(500, "Search server is not running or reachable")

    search_results = []
    search_string = ""
    if "search_string" in request.values and request.values["search_string"]:
        search_string = request.values["search_string"]
        # combined user and group ids into a global list
        irods_acl_reader_ids = [g.irods_session.user.id]
        irods_acl_reader_ids.extend(g.irods_session.my_group_ids)

        search_results = mango_osc.search(
            {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": request.values["search_string"],
                                    "fields": [
                                        "irods_name^4",
                                        "mango_descriptive_text_basket",
                                    ],
                                    "fuzziness": "AUTO",
                                    "fuzzy_transpositions": True,
                                    "minimum_should_match": 1,
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
                                            "terms": {
                                                "irods_acl_reader_ids": irods_acl_reader_ids
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
