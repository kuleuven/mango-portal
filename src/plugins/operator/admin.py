from flask import Blueprint, render_template, g, request, redirect, flash
from . import zone_operator_sessions, remove_zone_operator_session
from mango_ui import register_module_admin

from plugins.admin import require_mango_portal_admin

operator_admin_bp = Blueprint(
    "operator_admin_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Operator",
    "bootstrap_icon": "robot",
    "description": "Operator accounts are used for various tasks that require rodsadmin level access",
    "index": "index",
    "blueprint": "operator_admin_bp",
}

register_module_admin(**ADMIN_UI)


@operator_admin_bp.route("/operator/admin", methods=["GET"])
@require_mango_portal_admin
def index():
    return render_template(
        "operator/admin_index.html.j2", zone_operator_sessions=zone_operator_sessions
    )


@operator_admin_bp.route("/operator/admin/remove-session", methods=["POST", "DELETE"])
@require_mango_portal_admin
def remove_operator_session():
    if zone := request.form.get("zone", False):
        if remove_zone_operator_session(zone):
            flash(f"Removed operator session for zone {zone}", "success")
        else:
            flash(f"Something went wrong trying to remove session for zone {zone} ")

    return redirect(request.referrer)

@operator_admin_bp.route("/operator-reset-all", methods=["GET","POST"])
def reset_all():
    for zone in zone_operator_sessions:
        if remove_operator_session(zone):
            flash(f"Removed operator session for zone {zone}", "success")
        else:
            flash(f"Something went wrong trying to remove session for zone {zone} ")

    return redirect("/")
