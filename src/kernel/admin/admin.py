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
from mango_ui import register_module_admin
import irods_session_pool

admin_admin_bp = Blueprint(
    "admin_admin_bp", __name__, template_folder="templates/admin"
)

ADMIN_UI = {
    "title": "Node",
    "bootstrap_icon": "hdd-network",
    "description": "Basic info about the current node",
    "blueprint": admin_admin_bp.name,
}

register_module_admin(**ADMIN_UI)


@admin_admin_bp.route("/admin")
def index():
    return render_template("admin_index.html.j2")


@admin_admin_bp.route("/admin/sessions/node")
def node_sessions():
    """ """
    return render_template(
        "node_sessions.html.j2",
        user_sessions=irods_session_pool.irods_user_sessions,
        cleanup_start=irods_session_pool.cleanup_old_sessions_thread.start_time,
    )


@admin_admin_bp.route("/admin/logins/node")
def node_logins():
    # global logins_since_server_start
    return render_template(
        "node_logins.html.j2",
        logins_since_server_start=irods_session_pool.irods_node_logins,
    )
