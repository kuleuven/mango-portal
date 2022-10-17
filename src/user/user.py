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
from irods.exception import PAM_AUTH_PASSWORD_FAILED

# from irods.session import iRODSSession
from irods.user import iRODSUser, iRODSUserGroup, UserGroup
from pprint import pprint, pformat
import irods_session_pool
import ssl

from irods_zones_config import irods_zones, DEFAULT_IRODS_PARAMETERS, DEFAULT_SSL_PARAMETERS

user_bp = Blueprint(
    "user_bp", __name__, static_folder="static/user", template_folder="templates"
)
# iRODSSession.query()


@user_bp.route("/user/groups")
def my_groups():
    """
    """

    my_groups = [
        iRODSUserGroup(g.irods_session.user_groups, item)
        for item in g.irods_session.query(UserGroup)
        .filter(User.name == g.irods_session.username)
        .all()
    ]

    my_groups = [group for group in my_groups if group.name != g.irods_session.username]
    return render_template("mygroups.html.j2", my_groups=my_groups)


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
    my_groups = [group for group in my_groups if group.name != g.irods_session.username]

    # logged in since info
    logged_in_since = irods_session_pool.irods_user_sessions[session['userid']].created

    return render_template("myprofile.html.j2", me=me, my_groups=my_groups, logged_in_since=logged_in_since)


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

@user_bp.route("/user/login", methods=["GET", "POST"])
def login_basic():
    """ Basic login using username and password """
    if request.method == 'GET':
        return render_template('login_basic.html.j2')
    if request.method== 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        zone = request.form.get('irods_zone')

        if username == '':
            flash('Missing user id', category='danger')
            return render_template('login_basic.html.j2')
        if password == '':
            flash('Missing password', category='danger')
            return render_template('login_basic.html.j2')
        try:
            parameters = DEFAULT_IRODS_PARAMETERS.copy()
            ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
            parameters.update(irods_zones[zone]['parameters'])
            ssl_settings.update(irods_zones[zone]['ssl_settings'])
            irods_session = iRODSSession(
                user=username,
                password=password,
                **parameters,
                **ssl_settings
            )

        except Exception as e:
            print(e)
            flash('Could not create iRODS session', category='danger')
            return render_template('login_basic.html.j2')

        # sanity check on credentials
        try:
            irods_session.collections.get(f"/{irods_session.zone}/home")
        except PAM_AUTH_PASSWORD_FAILED as e:
            print(e)
            flash('Authentication failed: invalid password', category='danger')
            return render_template('login_basic.html.j2')

        except Exception as e:
            print(e)
            flash('Authentication failed: '+str(e))
            return render_template('login_basic.html.j2', category='danger')

        # should be ok now to add session to pool
        irods_session_pool.add_irods_session(username, irods_session)
        session['userid'] = username
        session['password'] = password
        session['zone'] = irods_session.zone

        return redirect(url_for('index'))



@user_bp.route('/user/logout')
def logout_basic():
    if 'userid' in session:
        irods_session_pool.remove_irods_session(session['userid'])
    return redirect(url_for('user_bp.login_basic'))