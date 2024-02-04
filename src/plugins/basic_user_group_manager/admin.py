from flask import Blueprint, render_template, g, request, redirect, flash, url_for
from irods.user import iRODSGroup
from irods.models import Group, User
from irods.session import iRODSSession
from mango_ui import register_module

basic_user_group_manager_admin_bp = Blueprint(
    "basic_user_group_manager_admin_bp", __name__, template_folder="templates"
)

UI = {
    "title": "Users & Groups",
    "bootstrap_icon": "person-gear",
    "description": "Basic User/Group administration, edit operations available for rodsadmin and groupadmin users",
    "blueprint": basic_user_group_manager_admin_bp.name,
    "index": "basic_user_group_manager_index",
}

register_module(**UI)


def current_user_can_manage(irods_session: iRODSSession):
    # allowed_users = []  # possible stricter rules, get this from config or env

    return (
        True
        if irods_session.user.type in ["rodsadmin", "groupadmin"]
        # and irods_session.username in allowed_users
        else False
    )


@basic_user_group_manager_admin_bp.route("/user_group_manager")
def basic_user_group_manager_index():

    operator_session: iRODSSession = g.irods_session
    groups = [
        iRODSGroup(operator_session.groups, item)
        for item in operator_session.query(Group).filter(User.type == "rodsgroup").all()
    ]

    editable = current_user_can_manage(operator_session)

    return render_template(
        "basic_user_group_manager/index.html.j2",
        groups=groups,
        protected_groups=["public", "rodsadmin"],
        editable=editable,
    )


@basic_user_group_manager_admin_bp.route("/basic_user_group_manager/<group>")
def view_members(group):
    """ """
    operator_session: iRODSSession = g.irods_session
    members = operator_session.groups.getmembers(group)
    all_users = operator_session.groups.getmembers("public")
    member_names = [member.name for member in members]
    all_user_names = [member.name for member in all_users]
    non_member_names = [
        member_name for member_name in all_user_names if member_name not in member_names
    ]
    non_members = [member for member in all_users if member.name in non_member_names]

    irodsgroup = operator_session.groups.get(group)

    return render_template(
        "basic_user_group_manager/view_group.html.j2",
        group=group,
        irodsgroup=irodsgroup,
        members=members,
        all_users=all_users,
        non_members=non_members,
        editable=current_user_can_manage(operator_session),
    )


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/add_group", methods=["POST"]
)
def add_group():
    operator_session: iRODSSession = g.irods_session
    group_name = request.form["group_name"].strip()
    try:
        new_group: iRODSGroup = operator_session.groups.create(group_name)
        return redirect(
            url_for(
                "basic_user_group_manager_admin_bp.view_members",
                group=group_name,
            )
        )
    except Exception as e:
        flash(f"Failed to create group {group_name} in realm {realm}: {e}", "danger")

    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/remove_group", methods=["POST", "DELETE"]
)
def remove_group():
    """ """
    operator_session = g.irods_session
    group_name = request.form["group_name"]
    try:
        operator_session.groups.remove(group_name)
    except Exception as e:
        flash(f"Failed to remove group: {e}", "danger")
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/add_members/<group>", methods=["POST"]
)
def add_members(group):
    """ """
    operator_session = g.irods_session
    members = request.form.getlist("members-to-add")
    try:
        for member in members:
            operator_session.groups.addmember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/remove_members/<group>", methods=["POST", "DELETE"]
)
def remove_members(group):
    """ """
    operator_session = g.irods_session
    members = request.form.getlist("members-to-remove")
    try:
        for member in members:
            operator_session.groups.removemember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/create_user", methods=["POST"], defaults={"group": None}
)
@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/create_user/<group>", methods=["POST"]
)
def create_user(group=None):
    operator_session: iRODSSession = g.irods_session
    user_name = request.form.get("user_name")
    password = request.form.get("password")
    user = None
    try:
        user = operator_session.users.create_with_password(user_name, password)
    except Exception as e:
        flash(f"Failed to create {user_name}: {e}", "danger")
    if group and user:
        try:
            operator_session.groups.addmember(group, user_name)
        except:
            flash(f"Failed to attach {user_name} to group {group}: {e}", "danger")

    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/basic_user_group_manager/remove_user", methods=["POST", "DELETE"]
)
def remove_user():
    operator_session: iRODSSession = g.irods_session
    user_name = request.form.get("user_name")
    if operator_session.user.type == "rodsadmin":
        try:
            operator_session.users.remove(user_name)
        except Exception as e:
            flash(f"failed to remove user: {e}", "danger")
    else:
        flash(f"You need to be rodsadmin to remove a user", "danger")
