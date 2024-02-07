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
    json,
)

from . import (
    add_index_job,
    get_open_search_client,
    MANGO_OPEN_SEARCH_INDEX_NAME,
    index_queue,
    indexing_thread,
    MANGO_INDEX_THREAD_SLEEP_TIME,
    IndexingThread,
    ping_open_search_servers,
    delete_all,
    MANGO_OPEN_SEARCH_INDEXING_IMPLEMENTATION
)
from opensearchpy import client

from irods.collection import iRODSCollection
import logging, time
from mango_ui import register_module_admin
from plugins.operator import get_zone_operator_session
from plugins.admin import require_mango_portal_admin

mango_open_search_admin_bp = Blueprint(
    "mango_open_search_admin_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Opensearch",
    "bootstrap_icon": "search",
    "description": "Opensearch tools",
    "blueprint": mango_open_search_admin_bp.name,
}

register_module_admin(**ADMIN_UI)


@mango_open_search_admin_bp.route("/mango-open-search/admin")
@require_mango_portal_admin
def index():
    result = {}
    global index_queue
    if (queue_length := len(index_queue)) > 50:
        logging.info(f"queue length: {queue_length}")
        result = {"oldest": index_queue[:10], "newest": index_queue[-10:]}
    else:
        logging.info(f"queue length: {queue_length}")
        result = {"all": index_queue}

    result["queue_length"] = queue_length

    zone_operator_session = get_zone_operator_session(g.irods_session.zone)
    root_collection: iRODSCollection = zone_operator_session.collections.get(
        f"/{g.irods_session.zone}"
    )
    home_collection: iRODSCollection = zone_operator_session.collections.get(
        f"/{g.irods_session.zone}/home"
    )

    available_collections = (
        root_collection.subcollections + home_collection.subcollections
    )

    return render_template(
        "mango_open_search/admin_index.html.j2",
        result=result,
        available_collections=available_collections,
        indexing_thread_status=indexing_thread.status,
        indexing_thread_health=indexing_thread.is_alive(),
        server_health=ping_open_search_servers(),
        indexing_implementation=MANGO_OPEN_SEARCH_INDEXING_IMPLEMENTATION
    )


@mango_open_search_admin_bp.route(
    "/mango-open-search/admin/change-index-status", methods=["POST"]
)
@require_mango_portal_admin
def change_index_thread_status():
    if "status" in request.form and (status := request.form["status"]):
        indexing_thread.set_status(status)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@mango_open_search_admin_bp.route(
    "/mango-open-search/admin/refresh-clients", methods=["POST"]
)
@require_mango_portal_admin
def refresh_clients():
    get_open_search_client(refresh=True)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@mango_open_search_admin_bp.route(
    "/mango-open-search/admin/restart-indexing-thread", methods=["POST"]
)
@require_mango_portal_admin
def refresh_indexing_thread():
    global indexing_thread
    indexing_thread.stop()
    time.sleep(MANGO_INDEX_THREAD_SLEEP_TIME + 1)
    indexing_thread = IndexingThread()
    indexing_thread.start()

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)

@mango_open_search_admin_bp.route(
    "/mango-open-search/admin/delete-index", methods=["POST"]
)
@require_mango_portal_admin
def clear_index():
    delete_all()

    if "redirect_route" in request.values:
            return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)
