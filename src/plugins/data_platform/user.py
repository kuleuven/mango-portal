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

data_platform_user_bp = Blueprint(
    "data_platform_bp", __name__, template_folder="templates"
)

@data_platform_user_bp.route("/data-platform/connection-info", methods=["GET"])
def connection_info():
    view_template = "connection_info.html.j2"
    return render_template(
        view_template
    )
