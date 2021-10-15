from flask import (
    Blueprint,
    current_app as app,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
    jsonify,
)
from irods.models import User

from irods.session import iRODSSession
from irods.user import iRODSUser, iRODSUserGroup, UserGroup
from pprint import pprint, pformat

user_bp = Blueprint(
    "user_bp", __name__, static_folder="static/user", template_folder="templates"
)
# iRODSSession.query()


@user_bp.route("/user/groups")
def my_groups():
    """
    """
    # result = g.irods_session.query(iRODSUserGroup, iRODSUser)

    user_groups = (
        g.irods_session.query(UserGroup).filter(User.type == "rodsgroup").all()
    )
    # pprint(user_groups)
    # return pformat(dir(g.irods_session.users.get(g.irods_session.username)))
    o_groups = [
        (
            iRODSUserGroup(g.irods_session.user_groups, result).name,
            iRODSUser(g.irods_session.users, result).name,
        )
        for result in g.irods_session.query(UserGroup, User)
    ]

    my_groups = [
        iRODSUserGroup(g.irods_session.user_groups, item)
        for item in g.irods_session.query(UserGroup)
        .filter(User.name == g.irods_session.username)
        .all()
    ]
    members = {group.name: group.members for group in my_groups}

    me = g.irods_session.users.get(g.irods_session.username)
    # return g.irods_session.pool.account.client_user

    return pformat(members)
    # return pformat(o_groups)
    # return jsonify(me.name, me.info)


@user_bp.route("/user/profile")
def my_profile():
    """
    """
    my_groups = [
        iRODSUserGroup(g.irods_session.user_groups, item)
        for item in g.irods_session.query(UserGroup)
        .filter(User.name == g.irods_session.username)
        .all()
    ]

    me = g.irods_session.users.get(g.irods_session.username)

    return render_template("myprofile.html.j2", me=me, my_groups=my_groups)


@user_bp.route("/group/members/<group_name>")
def group_members(group_name):
    """
    """
    members = []
    status = "Ok"
    try:
        my_group = g.irods_session.user_groups.get(group_name)
        members = my_group.members

    except Exception:
        status = "Error"

    return render_template(
        "group_members.html.j2", group_name=group_name, members=members, status=status
    )
