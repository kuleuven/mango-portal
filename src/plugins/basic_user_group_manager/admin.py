from flask import (Blueprint, flash, g, redirect, render_template, request,
                   url_for)
from irods.models import Group, User
from irods.user import iRODSGroup

from irods_session_pool import iRODSUserSession
from mango_ui import register_module

basic_user_group_manager_admin_bp = Blueprint(
    "basic_user_group_manager_admin_bp", __name__, template_folder="templates"
)

UI = {
    "title": "Users & Groups",
    "bootstrap_icon": "person-gear",
    "description": "Basic User/Group administration, edit operations available for rodsadmin and groupadmin users",
    "blueprint": basic_user_group_manager_admin_bp.name,
    "index": "user_group_manager_index",
}

register_module(**UI)


def current_user_can_manage(mango_irods_session: iRODSUserSession):
    # allowed_users = []  # possible stricter rules, get this from config or env

    return (
        True
        if mango_irods_session.user_object.type in ["rodsadmin", "groupadmin"]
        # and irods_session.username in allowed_users
        else False
    )


@basic_user_group_manager_admin_bp.route("/user_group_manager")
def user_group_manager_index():

    mango_irods_session: iRODSUserSession = g.irods_session
    groups = [
        iRODSGroup(mango_irods_session.groups, item)
        for item in mango_irods_session.query(Group).filter(User.type == "rodsgroup").all()
    ]

    editable = current_user_can_manage(mango_irods_session)

    return render_template(
        "basic_user_group_manager/index.html.j2",
        groups=groups,
        protected_groups=["public", "rodsadmin"],
        editable=editable,
    )


@basic_user_group_manager_admin_bp.route("/basic_user_group_manager/<group>")
def view_members(group):
    """ """
    mango_irods_session: iRODSUserSession = g.irods_session
    members = mango_irods_session.groups.getmembers(group)
    all_users = mango_irods_session.groups.getmembers("public")
    member_names = [member.name for member in members]
    all_user_names = [member.name for member in all_users]
    non_member_names = [
        member_name for member_name in all_user_names if member_name not in member_names
    ]
    non_members = [member for member in all_users if member.name in non_member_names]

    irodsgroup = mango_irods_session.groups.get(group)
    protected_groups = ["public", "rodsadmin"]

    return render_template(
        "basic_user_group_manager/view_group.html.j2",
        group=group,
        irodsgroup=irodsgroup,
        members=members,
        all_users=all_users,
        non_members=non_members,
        editable=current_user_can_manage(mango_irods_session),
        is_protected_group=group in protected_groups,
        protected_groups=protected_groups,
        current_user_is_rodsadmin=g.irods_session.user_object.type == "rodsadmin",
    )


@basic_user_group_manager_admin_bp.route(
    "/user_group_manager/add_group", methods=["POST"]
)
def add_group():
    mango_irods_session: iRODSUserSession = g.irods_session
    group_name = request.form["group_name"].strip()
    try:
        new_group: iRODSGroup = mango_irods_session.groups.create(group_name)
        return redirect(
            url_for(
                "basic_user_group_manager_admin_bp.view_members",
                group=group_name,
            )
        )
    except Exception as e:
        flash(f"Failed to create group {group_name}: {e}", "danger")

    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/user_group_manager/remove_group", methods=["POST", "DELETE"]
)
def remove_group():
    """ """
    mango_irods_session = g.irods_session
    group_name = request.form["group_name"]
    try:
        mango_irods_session.groups.remove(group_name)
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
    "/user_group_manager/add_members/<group>", methods=["POST"]
)
def add_members(group):
    """ """
    mango_irods_session: iRODSUserSession = g.irods_session
    members = request.form.getlist("members-to-add")
    try:
        for member in members:
            mango_irods_session.groups.addmember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/user_group_manager/remove_members/<group>", methods=["POST", "DELETE"]
)
def remove_members(group):
    """ """
    mango_irods_session: iRODSUserSession = g.irods_session
    members = request.form.getlist("members-to-remove")
    try:
        for member in members:
            mango_irods_session.groups.removemember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/user_group_manager/create_user", methods=["POST"]
)
def create_user(group=None):
    mango_irods_session: iRODSUserSession = g.irods_session
    user_name = request.form.get("user_name")
    password = request.form.get("password")
    group = request.form.get("group")
    user = None
    try:
        user = mango_irods_session.users.create_with_password(user_name, password)
    except Exception as e:
        flash(f"Failed to create {user_name}: {e}", "danger")
    if group and user and group != "public":
        try:
            mango_irods_session.groups.addmember(group, user_name)
        except Exception as e:
            flash(f"Failed to attach {user_name} to group {group}: {e}", "danger")

    return redirect(request.referrer)


@basic_user_group_manager_admin_bp.route(
    "/user_group_manager/remove_users", methods=["POST", "DELETE"]
)
def remove_users():
    mango_irods_session: iRODSUserSession = g.irods_session
    user_names = request.form.getlist("users-to-remove")
    if mango_irods_session.user_object.type == "rodsadmin":
        for user_name in user_names:
            try:
                mango_irods_session.users.remove(user_name)
            except Exception as e:
                flash(f"failed to remove user: {e}", "danger")
                break
    else:
        flash(f"You need to be rodsadmin to remove a user", "danger")

    return redirect(request.referrer)
