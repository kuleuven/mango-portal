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
    index_queue,
    indexing_thread,
    ping_open_search_servers,
)
from opensearchpy import client

from irods.collection import iRODSCollection
import logging

mango_open_search_admin_bp = Blueprint(
    "mango_open_search_admin_bp", __name__, template_folder="templates"
)

@mango_open_search_admin_bp.route('/mango-open-search/admin')
def index():
    result = {}
    global index_queue
    if (queue_length := len(index_queue)) > 50:
        logging.info(f"queue length: {queue_length}")
        result = {'oldest': index_queue[:10], 'newest': index_queue[-10:]}
    else:
        logging.info(f"queue length: {queue_length}")
        result = {'all': index_queue}

    result["queue_length"] = queue_length

    home_collection : iRODSCollection = g.irods_session.collections.get(f"/{g.irods_session.zone}/home")

    return render_template(
        'mango_open_search/admin_index.html.j2',
        result=result,
        available_collections = home_collection.subcollections,
        indexing_thread_status = indexing_thread.status,
        server_health = ping_open_search_servers()
        )

@mango_open_search_admin_bp.route('/mango-open-search/admin/change-index-status', methods=['POST'])
def change_index_thread_status():
    if 'status' in request.form and (status := request.form['status']) :
        indexing_thread.set_status(status)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)

@mango_open_search_admin_bp.route('/mango-open-search/admin/refresh-clients', methods=['POST'])
def refresh_clients():
    get_open_search_client(refresh=True)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)
