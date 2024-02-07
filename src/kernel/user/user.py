from datetime import datetime
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
)
from irods.models import User
from irods.session import iRODSSession
from irods.exception import PAM_AUTH_PASSWORD_FAILED
from kernel.template_overrides import get_template_override_manager

import irods_session_pool
import logging

from irods_zones_config import (
    irods_zones,
    DEFAULT_IRODS_PARAMETERS,
    DEFAULT_SSL_PARAMETERS,
)

user_bp = Blueprint(
    "user_bp", __name__, static_folder="static/user", template_folder="templates"
)
# iRODSSession.query()


@user_bp.route("/user/groups")
def my_groups():
    """ """

    my_groups = g.irods_session.my_groups
    return render_template("mygroups.html.j2", my_groups=my_groups)


@user_bp.route("/user/profile")
def my_profile():
    """ """

    me = g.irods_session.user
    my_groups = g.irods_session.my_groups

    # logged in since info
    logged_in_since = irods_session_pool.irods_user_sessions[session["userid"]].created

    home_total_size_in_bytes = 0
    n_data_objects = 0
    try:
        collection = g.irods_session.collections.get(
            f"/{g.irods_session.zone}/home/{g.irods_session.username}"
        )
        for info in collection.walk():
            n_data_objects += len(info[2])
            home_total_size_in_bytes += sum(d.size for d in info[2])
    except Exception:
        home_total_size_in_bytes = -1

    view_template = get_template_override_manager(
        g.irods_session.zone
    ).get_template_for_catalog_item(
        None, "user/myprofile.html.j2"
    )
    return render_template(
        view_template,
        me=me,
        my_groups=my_groups,
        logged_in_since=logged_in_since,
        home_total_size=home_total_size_in_bytes,
        n_data_objects=n_data_objects,
    )


@user_bp.route("/group/members/<group_name>")
def group_members(group_name):
    """ """
    members = []
    status = "Ok"
    try:
        my_group = g.irods_session.user_groups.get(group_name)
        members = my_group.members

    except Exception:
        status = "Error"

    view_template = get_template_override_manager(
        g.irods_session.zone
    ).get_template_for_catalog_item(
        None, "user/group_members.html.j2"
    )

    return render_template(
        view_template,
        group_name=group_name,
        members=members,
        status=status,
    )


@user_bp.route("/user/login", methods=["GET", "POST"])
def login_basic():
    """Basic login using username and password"""
    if request.method == "GET":
        userid = ""
        last_zone_name = ""
        if "userid" in session:
            userid = session["userid"]
        if "zone" in session:
            last_zone_name = session["zone"]
        return render_template(
            "user/login_basic.html.j2", userid=userid, last_zone_name=last_zone_name
        )
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        zone = request.form.get("irods_zone")

        if username == "":
            flash("Missing user id", category="danger")
            return render_template("user/login_basic.html.j2")
        if password == "":
            flash("Missing password", category="danger")
            return render_template("user/login_basic.html.j2")

        connection_info = irods_connection_info(
            zone=zone, username=username, password=password
        )

        try:
            irods_session = iRODSSession(
                user=username,
                password=password,
                **connection_info["parameters"],
                **connection_info["ssl_settings"],
            )

        except Exception as e:
            print(e)
            flash("Could not create iRODS session", category="danger")
            return render_template("user/login_basic.html.j2")

        # sanity check on credentials
        try:
            irods_session.collections.get(f"/{irods_session.zone}/home")
        except PAM_AUTH_PASSWORD_FAILED as e:
            print(e)
            flash("Authentication failed: invalid password", category="danger")
            return render_template("user/login_basic.html.j2")

        except Exception as e:
            print(e)
            flash("Authentication failed: " + str(e))
            return render_template("user/login_basic.html.j2", category="danger")

        # should be ok now to add session to pool
        irods_session_pool.add_irods_session(username, irods_session)
        session["userid"] = username
        session["password"] = password
        session["zone"] = irods_session.zone

        irods_session_pool.irods_node_logins += [
            {
                "userid": username,
                "zone": irods_session.zone,
                "login_time": datetime.now(),
            }
        ]
        logging.info(
            f"User {irods_session.username}, zone {irods_session.zone} logged in"
        )

        return redirect(url_for("index"))


def irods_connection_info(zone, username, password):
    """
    Callback to retrieve connection information for a certain zone, username and password.
    """

    parameters = DEFAULT_IRODS_PARAMETERS.copy()
    ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
    parameters.update(irods_zones[zone]["parameters"])
    ssl_settings.update(irods_zones[zone]["ssl_settings"])
    parameters["irods_user_name"] = username

    return {
        "parameters": parameters,
        "ssl_settings": ssl_settings,
        "password": password,
    }


@user_bp.route("/user/logout")
def logout_basic():
    if "userid" in session:
        irods_session_pool.remove_irods_session(session["userid"])
        del session["password"]

    return redirect(url_for(app.config["MANGO_LOGIN_ACTION"]))
