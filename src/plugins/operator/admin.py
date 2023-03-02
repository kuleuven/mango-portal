from flask import Blueprint, render_template, g
from . import zone_operator_sessions

operator_admin_bp = Blueprint(
    "operator_admin_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Operator",
    "icon": "android2",
    "description": "Operator accounts are used for various tasks that require rodsadmin level access",
}


@operator_admin_bp.route("/operator/admin", methods=["GET"])
def index():
    return render_template(
        "operator/index.html.j2", zone_operator_sessions=zone_operator_sessions
    )
