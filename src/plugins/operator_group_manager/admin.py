from flask import Blueprint, render_template, g, request, redirect, flash, url_for
from . import get_operator_session
from irods.user import iRODSGroup, iRODSUser
from irods.models import Group, User
from irods.column import Like
from irods.session import iRODSSession
from cache import cache
import re, logging

operator_group_manager_admin_bp = Blueprint(
    "operator_group_manager_admin_bp", __name__, template_folder="templates"
)

ADMIN_UI = {
    "title": "Group administration",
    "icon": "people",
    "description": "Group administration using operator (rodsadmin) account",
}

# Protected groups are excluded from manipulation through the operator_group_manager functions
# as they are handled through the data api platform
PROTECTED_GROUP_SUFFIXES = ["", "_manager", "_ingress", "_egress", "_responsible"]


# @cache.memoize(1200)
def get_realms_for_projects(irods_session: iRODSSession, base_path):
    # for now a simple listing of everything found in the home collection
    project_collections = irods_session.collections.get(base_path).subcollections
    realms = [
        sub_collection.name
        for sub_collection in project_collections
        if not bool(re.match(r"((u|v|x|r).{2}\d{5})", sub_collection.name))
        and sub_collection.name != "public"
    ]
    print(realms)
    return realms


@operator_group_manager_admin_bp.route(
    "/operator_group_manager", defaults={"realm": None}
)
@operator_group_manager_admin_bp.route("/operator_group_manager/<realm>")
def index(realm: str):
    groups = []
    realms = []
    operator_session = get_operator_session(g.irods_session.zone)
    if realm:
        # operator_session.
        groups = [
            iRODSGroup(operator_session.groups, item)
            for item in operator_session.query(Group)
            .filter(Like(Group.name, f"{realm}%"))
            .filter(User.type == "rodsgroup")
            .all()
        ]

    if not realm:
        if "mango_admin" in g.irods_session.my_group_names:
            realms = get_realms_for_projects(
                operator_session, f"/{g.irods_session.zone}/home"
            )
        else:
            realms = get_realms_for_projects(
                g.irods_session, f"/{g.irods_session.zone}/home"
            )
    editable = False

    if {"datateam", f"{realm}_manager", "mango_admin"}.intersection(
        set(g.irods_session.my_group_names)
    ):
        editable = True

    return render_template(
        "operator_group_manager/index.html.j2",
        realm=realm,
        groups=groups,
        realms=realms,
        editable=editable,
    )


@operator_group_manager_admin_bp.route("/operator_group_manager/<realm>/<group>")
def view_members(realm, group):
    """ """
    operator_session = get_operator_session(g.irods_session.zone)
    members = operator_session.groups.getmembers(group)
    realm_members = operator_session.groups.getmembers(realm)
    member_names = [member.name for member in members]
    realm_member_names = [member.name for member in realm_members]
    non_member_names = [
        member_name
        for member_name in realm_member_names
        if member_name not in member_names
    ]
    non_members = [
        member for member in realm_members if member.name in non_member_names
    ]

    editable = False
    if group not in [f"{realm}{suffix}" for suffix in PROTECTED_GROUP_SUFFIXES] and (
        {"datateam", f"{realm}_manager", "mango_admin"}.intersection(
            set(g.irods_session.my_group_names)
        )
    ):
        editable = True

    return render_template(
        "operator_group_manager/view_group.html.j2",
        realm=realm,
        group=group,
        members=members,
        realm_members=realm_members,
        non_members=non_members,
        editable=editable
        if group not in [f"{realm}{suffix}" for suffix in PROTECTED_GROUP_SUFFIXES]
        else False,
    )


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/add_group/<realm>", methods=["POST"]
)
def add_group(realm):
    operator_session = get_operator_session(g.irods_session.zone)
    group_name = f"{realm}_{request.form['group_name_suffix']}"
    try:
        operator_session.groups.create(group_name)
        return redirect(
            url_for(
                "operator_group_manager_admin_bp.view_members",
                realm=realm,
                group=group_name,
            )
        )
    except Exception as e:
        flash(f"Failed to create group {group_name} in realm {realm}: {e}", "danger")

    return redirect(request.referrer)


# @operator_group_manager_admin_bp.route(
#     "/operator_group_manager/remove_group/<realm>", methods=["POST", "DELETE"]
# )
# def remove_group(realm):
#     """ """
#     operator_session = get_operator_session(g.irods_session.zone)
#     group_name = request.form["group_name"]
#     try:
#         operator_session.groups.remove(group_name)
#     except Exception as e:
#         flash(f"Failed to remove group: {e}", "danger")
#     return redirect(request.referrer)


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/add_members/<realm>/<group>", methods=["POST"]
)
def add_members(realm, group):
    """ """
    operator_session = get_operator_session(g.irods_session.zone)
    members = request.form.getlist("members-to-add")
    try:
        for member in members:
            operator_session.groups.addmember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/remove_members/<realm>/<group>", methods=["POST", "DELETE"]
)
def remove_members(realm, group):
    """ """
    operator_session = get_operator_session(g.irods_session.zone)
    members = request.form.getlist("members-to-remove")
    try:
        for member in members:
            operator_session.groups.removemember(group, member)
    except Exception as e:
        flash(f"Failed to add members {members} to group {group}: {e}", "danger")
    return redirect(request.referrer)
