from flask import Blueprint, render_template, g
from . import get_operator_session

group_manager_admin_bp = Blueprint(
    "group_manager_admin_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Group administration",
    "icon": "people",
    "description": "Group admistration",
}


@group_manager_admin_bp.route("/plugins/group_manager", methods=["GET"])
def index():
    operator_session = get_operator_session(g.irods_session.zone)
    groups = [
        group
        for group in operator_session.user_groups
        if group.name != g.irods_session.username
    ]
    return render_template("group_manager/index.html.j2", groups=groups)
