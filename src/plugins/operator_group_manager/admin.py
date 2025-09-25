import re

from flask import (
    Blueprint,
    current_app,
    flash,
    g,
    redirect,
    render_template,
    request,
    url_for,
)
from irods.column import Like
from irods.models import Group, User
from irods.session import iRODSSession
from irods.user import iRODSGroup, iRODSUser

from cache import cache
from lib.util import setup_mango_collection, setup_realm_plugin_collection
from mango_ui import register_module
from plugins.operator import get_zone_operator_session

from . import get_operator_session, group_definition_cud, yaml_definition_uploaded
from .validation import validate_user_management_yaml

operator_group_manager_admin_bp = Blueprint(
    "operator_group_manager_admin_bp",
    __name__,
    template_folder="templates",
    static_folder="static/operator_group_manager",
    static_url_path="/static/operator_group_manager",
)

UI = {
    "title": "Group administration",
    "bootstrap_icon": "people",
    "description": "Group administration using operator (rodsadmin) account",
    "blueprint": operator_group_manager_admin_bp.name,
    "index": "group_manager_index",
}

register_module(**UI)

# Protected groups are excluded from manipulation through the operator_group_manager functions
# as they are handled through the data api platform
PROTECTED_USER_GROUP_SUFFIXES = ["manager", "ingress", "egress", "responsible"]
USER_MANAGEMENT_SUFFIX = "user_management"
SEMANTIC_USER_GROUP_SUFFIXES = ["schema_manager", USER_MANAGEMENT_SUFFIX]


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
def group_manager_index(realm: str):
    groups = []
    realms = []
    operator_session = get_operator_session(g.irods_session.zone)
    # automatic user management
    user_management_yaml = {}
    if realm:
        # operator_session.
        groups = [
            iRODSGroup(operator_session.groups, item)
            for item in operator_session.query(Group)
            .filter(Like(Group.name, f"{realm}%"))
            .filter(User.type == "rodsgroup")
            .all()
        ]
        # automatic user management
        user_management_yaml["path"] = build_yaml_path(realm)
        try:
            user_management_yaml["object"] = g.irods_session.data_objects.get(
                user_management_yaml["path"]
            )
            with user_management_yaml["object"].open("r") as f:
                user_management_yaml["contents"] = f.read().decode()
            valid, message = validate_user_management_yaml(
                user_management_yaml["contents"]
            )
            if not valid:
                user_management_yaml["validation_message"] = message
        except:
            user_management_yaml["contents"] = ""

    if not realm:
        if "mango_admin" in g.irods_session.my_group_names:
            realms = get_realms_for_projects(
                operator_session, f"/{g.irods_session.zone}/home"
            )
        else:
            realms = get_realms_for_projects(
                g.irods_session, f"/{g.irods_session.zone}/home"
            )

    editable = (
        True
        if (f"{realm}_manager" in g.irods_session.my_group_names)
        or (
            hasattr(g.irods_session, "roles")
            and "mango_portal_admin" in g.irods_session.roles
        )
        else False
    )
    current_user_is_group_manager = (
        f"{realm}_{USER_MANAGEMENT_SUFFIX}" in g.irods_session.my_group_names
    )

    missing_semantic_suffixes = []
    for sematic_suffix in SEMANTIC_USER_GROUP_SUFFIXES:
        if f"{realm}_{sematic_suffix}" not in [group.name for group in groups]:
            missing_semantic_suffixes.append(sematic_suffix)

    return render_template(
        "operator_group_manager/index.html.j2",
        realm=realm,
        groups=groups,
        realms=realms,
        editable=editable,
        semantic_suffixes=SEMANTIC_USER_GROUP_SUFFIXES,
        protected_groups=[
            f"{realm}_{protected_group_suffix}"
            for protected_group_suffix in PROTECTED_USER_GROUP_SUFFIXES
        ]
        + [realm],
        missing_semantic_suffixes=missing_semantic_suffixes,
        zone=g.irods_session.zone,
        current_user_is_group_manager=current_user_is_group_manager,
        user_management_yaml=user_management_yaml,
    )


@operator_group_manager_admin_bp.route("/operator_group_manager/<realm>/<group>")
def view_members(realm, group):
    """ """
    operator_session: iRODSSession = get_operator_session(g.irods_session.zone)
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

    protected_group = (
        True
        if group
        in [f"{realm}_{suffix}" for suffix in PROTECTED_USER_GROUP_SUFFIXES] + [realm]
        else False
    )

    current_user_is_group_manager = (
        True
        if (f"{realm}_manager" in g.irods_session.my_group_names)
        or (
            hasattr(g.irods_session, "roles")
            and "mango_portal_admin" in g.irods_session.roles
        )
        else False
    )

    irodsgroup = operator_session.groups.get(group)
    metadata = irodsgroup.metadata.items()
    has_realm_set = False
    try:
        avu = irodsgroup.metadata.get_one("mg.realm")
        has_realm_set = avu.value
    except:
        has_realm_set = False

    has_valid_realm = False
    if has_realm_set and has_realm_set == realm:
        has_valid_realm = True

    return render_template(
        "operator_group_manager/view_group.html.j2",
        realm=realm,
        group=group,
        irodsgroup=irodsgroup,
        has_metadata=len(irodsgroup.metadata.items()),
        has_realm_set=has_realm_set,
        has_valid_realm=has_valid_realm,
        members=members,
        realm_members=realm_members,
        non_members=non_members,
        protected_group=protected_group,
        current_user_is_group_manager=current_user_is_group_manager,
        editable=current_user_is_group_manager and not protected_group,
    )


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/add_group/<realm>", methods=["POST"]
)
def add_group(realm):
    operator_session = get_operator_session(g.irods_session.zone)
    group_name = f"{realm}_{request.form['group_name_suffix']}"
    try:
        new_group: iRODSGroup = operator_session.groups.create(group_name)
        new_group.metadata.add("mg.realm", realm)
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


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/remove_group/<realm>", methods=["POST", "DELETE"]
)
def remove_group(realm):
    """ """
    operator_session = get_operator_session(g.irods_session.zone)
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


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/set/realm/<realm>/<group>", methods=["POST"]
)
def set_realm(realm, group):
    try:
        operator_session = get_operator_session(g.irods_session.zone)
        irodsgroup = operator_session.groups.get(group)
        metadata = irodsgroup.metadata.items()
        if "mg.realm" in [avu.name for avu in metadata]:
            irodsgroup.metadata.remove("mg.realm")
        irodsgroup.metadata.add("mg.realm", realm)
    except Exception as e:
        flash(f"Failed to add realm {realm} to group {group}: {e}", "danger")
    return redirect(request.referrer)


# AUTOMATIC USER MANAGEMENT


def build_yaml_path(realm):
    return f"/{g.irods_session.zone}/mango/{realm}/user_management/user_groups.yaml"


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/validate_yaml/<realm>/", methods=["POST"]
)
def validate_yaml(realm: str):
    yaml_path = build_yaml_path(realm)
    yaml_contents = request.form["user-management-yaml-contents"]
    validation, result = validate_user_management_yaml(yaml_contents)
    return [yaml_path if validation else validation, result]


def setup_user_management_collection(zone, realm):
    operator_session = get_operator_session(zone)
    # create directory if it does not exist and provide permissions
    rods_session = get_zone_operator_session(zone, client_user="rods")
    mango_collection = setup_mango_collection(rods_session, operator_session.username)

    setup_realm_plugin_collection(
        operator_session,
        realm,
        "user_management",
        mango_collection,
        f"{realm}_{USER_MANAGEMENT_SUFFIX}",
    )


@operator_group_manager_admin_bp.route(
    "/operator_group_manager/add_yaml/<realm>", methods=["POST"]
)
def add_yaml(realm: str):
    yaml_contents = request.form["user-management-yaml-contents"]
    validation, result = validate_user_management_yaml(yaml_contents)
    if not validation:
        flash(result, "error")
        return redirect(request.referrer)

    setup_user_management_collection(g.irods_session.zone, realm)
    yaml_path = build_yaml_path(realm)
    # it should be fine if the user is part of the user_management group :)
    with g.irods_session.data_objects.open(yaml_path, "w", create=True) as f:
        f.write(yaml_contents.encode())
    flash(
        f"The YAML has been successfully uploaded to <code>{yaml_path}</code>",
        "success",
    )
    # emit the signal with the current yamp path
    yaml_definition_uploaded.send(
        current_app._get_current_object(),
        irods_session=g.irods_session,
        yaml_path=yaml_path,
    )
    return redirect(request.referrer)
