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

# from irods.session import iRODSSession
from irods.user import iRODSUser, iRODSUserGroup, UserGroup
from pprint import pprint, pformat
import irods_session_pool
import logging

from oic.oic import Client
from oic.utils.authn.client import CLIENT_AUTHN_METHOD
from oic.oic.message import RegistrationResponse, AuthorizationResponse
from oic import rndstr

from irods_zones_config import irods_zones, openid_providers, irods_connection_info

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

    home_total_size_in_bytes = 0
    n_data_objects = 0
    try:
        collection = g.irods_session.collections.get(f"/{g.irods_session.zone}/home/{g.irods_session.username}")
        for info in collection.walk( ):
            n_data_objects += len( info[2] )
            home_total_size_in_bytes += sum( d.size for d in info[2] )
    except e:
        home_total_size_in_bytes = -1


    return render_template("myprofile.html.j2", me=me, my_groups=my_groups, logged_in_since=logged_in_since, home_total_size=home_total_size_in_bytes, n_data_objects = n_data_objects)


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
        userid=''
        last_zone_name=''
        if 'userid' in session:
            userid = session['userid']
        if 'zone' in session:
            last_zone_name = session['zone']
        return render_template('login_basic.html.j2', userid=userid, last_zone_name=last_zone_name)
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

        connection_info = irods_connection_info(login_method="basic", zone=zone, username=username, password=password)

        try:
            irods_session = iRODSSession(
                user=username,
                password=password,
                **connection_info['parameters'],
                **connection_info['ssl_settings']
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

        irods_session_pool.irods_node_logins += [{'userid': username, 'zone': irods_session.zone, 'login_time': datetime.now()}]
        logging.info(f"User {irods_session.username}, zone {irods_session.zone} logged in")

        return redirect(url_for('index'))



@user_bp.route('/user/logout')
def logout_basic():
    if 'userid' in session:
        irods_session_pool.remove_irods_session(session['userid'])

    if app.config["MANGO_AUTH"] == 'openid':
        return redirect(url_for('user_bp.login_openid'))
    #default
    return redirect(url_for('user_bp.login_basic'))


@user_bp.route('/user/login_zone', methods=["GET", "POST"])
def login_zone():
    """
    """
    if request.method == 'GET':
        last_zone_name=''

        if 'zone' in session:
            last_zone_name = session['zone']
        return render_template('login_zone.html.j2', last_zone_name=last_zone_name)

    if request.method == 'POST':
        host = request.host
        scheme = request.scheme
        zone = request.form.get('irods_zone')
        if zone in irods_zones:
            auth_uri = f"https://{irods_zones[zone]['parameters']['host']}/auth/iinit?redirect_uri={scheme}://{host}/user/login_zone_callback"
            print(f"Auth uri: {auth_uri}")
            return redirect(auth_uri)
        else:
            flash('Unknown zone', category='danger')
            return render_template('login_zone.html.j2', )



@user_bp.route('/user/login_zone_callback')
def login_via_go_callback():
    """
    """

    user_name = request.args.get('user_name', '')
    password = request.args.get('password', '')
    zone = request.args.get('zone_name', '')
    connection_info = irods_connection_info(login_method="go_callback", zone=zone, username=user_name, password=password)

    if not user_name or not password or not zone:
        flash('Could not obtain user name or password or zone name, did you select the right zone', category='danger')
        return render_template('login_zone.html.j2')

    try:
        irods_session = iRODSSession(
            user=user_name,
            password=password,
            **connection_info['parameters'],
            **connection_info['ssl_settings']
        )

        irods_session_pool.add_irods_session(user_name, irods_session)
        session['userid'] = user_name
        session['password'] = password
        session['zone'] = irods_session.zone

        irods_session_pool.irods_node_logins += [{'userid': user_name, 'zone': irods_session.zone, 'login_time': datetime.now()}]
        logging.info(f"User {irods_session.username}, zone {irods_session.zone} logged in")

    except Exception as e:
        print(e)
        flash('Could not create iRODS session', category='danger')
        return render_template('login_zone.html.j2')

    return redirect(url_for('index'))



@user_bp.route('/user/login_openid', methods=["GET", "POST"])
def login_openid():
    """
    """

    if request.method == 'GET':
        last_openid_provider=''

        if 'openid_provider' in session:
            last_openid_provider = session['openid_provider']
        return render_template('login_openid.html.j2', last_openid_provider=last_openid_provider)

    if request.method == 'POST':
        host = request.host
        openid_provider = request.form.get('openid_provider')

        if openid_provider not in openid_providers:
            flash('Unknown openid provider', category='danger')
            return render_template('login_openid.html.j2', )

        provider_config = openid_providers[openid_provider]

        client = Client(client_authn_method=CLIENT_AUTHN_METHOD)
        issuer_url = provider_config['issuer_url']
        provider_info = client.provider_config(issuer_url)
        client_reg = RegistrationResponse(client_id=provider_config['client_id'], client_secret=provider_config['secret'])
        client.store_registration_info(client_reg)

        session["openid_state"] = rndstr()
        session["openid_nonce"] = rndstr()
        args = {
            "client_id": client.client_id,
            "response_type": "code",
            "scope": ["openid"],
            "nonce": session["openid_nonce"],
            "redirect_uri": f"https://{host}/user/openid/callback/{openid_provider}",
            "state": session["openid_state"]
        }

        auth_req = client.construct_AuthorizationRequest(request_args=args)
        auth_uri = auth_req.request(client.authorization_endpoint)

        return redirect(auth_uri)



@user_bp.route('/user/openid/callback/<openid_provider>')
def login_openid_callback(openid_provider):
    """
    """

    if openid_provider not in openid_providers:
        flash('Unknown openid provider', category='danger')
        return render_template('login_openid.html.j2', )

    provider_config = openid_providers[openid_provider]

    client = Client(client_authn_method=CLIENT_AUTHN_METHOD)
    issuer_url = provider_config['issuer_url']
    provider_info = client.provider_config(issuer_url)
    client_reg = RegistrationResponse(client_id=provider_config['client_id'], client_secret=provider_config['secret'])
    client.store_registration_info(client_reg)

    query_string = request.query_string.decode('utf-8')
    authn_resp = client.parse_response(AuthorizationResponse, info=query_string, sformat='urlencoded')

    if authn_resp["state"] != session.pop('openid_state'):
        flash('Invalid state', category='danger')
        return render_template('login_openid.html.j2')

    host = request.host
    args = {
        "code": authn_resp["code"],
        "redirect_uri": f"https://{host}/user/openid/callback/{openid_provider}",
    }
    token_resp = client.do_access_token_request(state=authn_resp["state"], request_args=args, authn_method="client_secret_basic")

    id_token = token_resp['id_token']

    if id_token['nonce'] != session.pop('openid_nonce'):
        flash('Invalid nonce', category='danger')
        return render_template('login_openid.html.j2')

    userinfo = client.do_user_info_request(state=authn_resp["state"])
    if userinfo['sub'] != id_token['sub']:
        flash('The \'sub\' of userinfo does not match \'sub\' of ID Token.', category='danger')
        return render_template('login_openid.html.j2')

    # We are logged on
    session["openid_provider"] = openid_provider
    session["openid_username"] = userinfo['preferred_username']

    return redirect(url_for('user_bp.login_openid_select_zone'))



@user_bp.route('/user/openid/choose_zone', methods=["GET", "POST"])
def login_openid_select_zone():
    if 'openid_username' not in session or 'openid_provider' not in session:
        flash('Please log in first', category='danger')
        return render_template('login_openid.html.j2')

    if request.method == 'GET':
        last_zone_name=''

        if 'zone_name' in session:
            last_zone_name = session['zone_name']

        zones_for_user = openid_providers[session['openid_provider']]['zones_for_user']

        zones = zones_for_user(session['openid_username'])

        return render_template('login_openid_select_zone.html.j2', zones=zones, last_zone_name=last_zone_name)

    zone = request.form.get('irods_zone')

    user_name = session['openid_username']
    connection_info = irods_connection_info(login_method="openid", zone=zone, username=user_name)
    password = connection_info['password']

    try:
        irods_session = iRODSSession(
            user=user_name,
            password=password,
            **connection_info['parameters'],
            **connection_info['ssl_settings']
        )

        irods_session_pool.add_irods_session(user_name, irods_session)
        session['userid'] = user_name
        session['password'] = password
        session['zone'] = irods_session.zone

        irods_session_pool.irods_node_logins += [{'userid': user_name, 'zone': irods_session.zone, 'login_time': datetime.now()}]
        logging.info(f"User {irods_session.username}, zone {irods_session.zone} logged in")

    except Exception as e:
        print(e)
        flash('Could not create iRODS session', category='danger')
        return render_template('login_openid_select_zone.html.j2')

    return redirect(url_for('index'))