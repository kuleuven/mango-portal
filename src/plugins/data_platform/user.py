from datetime import datetime
import requests
import json
from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    g,
    send_file,
    abort,
    stream_with_context,
    Response,
    request,
    session,
    flash,
)

from irods.session import iRODSSession
import irods_session_pool

from oic.oic import Client
from oic.utils.authn.client import CLIENT_AUTHN_METHOD
from oic.oic.message import RegistrationResponse, AuthorizationResponse
from oic import rndstr

from irods_zones_config import DEFAULT_IRODS_PARAMETERS, DEFAULT_SSL_PARAMETERS
from . import API_URL, API_TOKEN, openid_providers, openid_login_required, current_user_projects, current_user_api_token, current_zone_jobid

import logging


data_platform_user_bp = Blueprint(
    "data_platform_user_bp", __name__, template_folder="templates"
)

def irods_connection_info(zone, username):
    jobid = current_app.config['irods_zones'][zone]["jobid"]

    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.post(
        f"{API_URL}/v1/token",
        json={"username": username, "permissions": ["user"]},
        headers=header,
    )
    response.raise_for_status()

    user_api_token = response.json()["token"]

    header = {"Authorization": "Bearer " + user_api_token}
    response = requests.get(
        f"{API_URL}/v1/irods/zones/{jobid}/connection_info", headers=header
    )
    response.raise_for_status()

    info = response.json()

    parameters = DEFAULT_IRODS_PARAMETERS.copy()
    ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
    parameters.update(info["irods_environment"])

    if parameters["irods_authentication_scheme"] == "pam_password":
        parameters["irods_authentication_scheme"] = "PAM"

    password = info["token"]

    return {
        "parameters": parameters,
        "ssl_settings": ssl_settings,
        "password": password,
    }



@data_platform_user_bp.route('/user/login_openid', methods=["GET", "POST"])
def login_openid():
    """
    """

    if request.method == 'GET':
        for openid_provider in openid_providers:
            if 'auto_pick_on_host' in openid_provider and openid_provider['auto_pick_on_host'] == request.host:
                return redirect_to_idp(openid_provider)

        if 'openid_provider' in session:
            last_openid_provider = session['openid_provider']
        
        return render_template('user/login_openid.html.j2', openid_providers=openid_providers, last_openid_provider=last_openid_provider)

    if request.method == 'POST':
        openid_provider = request.form.get('openid_provider')

        if openid_provider not in openid_providers:
            flash('Unknown openid provider', category='danger')
            return render_template('user/login_openid.html.j2', openid_providers=openid_providers)

        return redirect_to_idp(openid_provider)

def redirect_to_idp(openid_provider):
    provider_config = openid_providers[openid_provider]

    host = request.host

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

@data_platform_user_bp.route('/user/openid/callback/<openid_provider>')
def login_openid_callback(openid_provider):
    """
    """

    if openid_provider not in openid_providers:
        flash('Unknown openid provider', category='danger')
        return render_template('user/login_openid.html.j2', openid_providers=openid_providers)

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
        return render_template('user/login_openid.html.j2', openid_providers=openid_providers)

    host = request.host
    args = {
        "code": authn_resp["code"],
        "redirect_uri": f"https://{host}/user/openid/callback/{openid_provider}",
    }
    token_resp = client.do_access_token_request(state=authn_resp["state"], request_args=args, authn_method="client_secret_basic")

    id_token = token_resp['id_token']

    if id_token['nonce'] != session.pop('openid_nonce'):
        flash('Invalid nonce', category='danger')
        return render_template('login_openid.html.j2', openid_providers=openid_providers)

    userinfo = client.do_user_info_request(state=authn_resp["state"])
    if userinfo['sub'] != id_token['sub']:
        flash('The \'sub\' of userinfo does not match \'sub\' of ID Token.', category='danger')
        return render_template('user/login_openid.html.j2', openid_providers=openid_providers)

    # We are logged on
    session["openid_provider"] = openid_provider
    session["openid_username"] = userinfo['preferred_username']
    if 'email' in userinfo:
        session["openid_user_email"] = userinfo["email"]
    if 'name' in userinfo:
        session["openid_user_name"] = userinfo["name"]

    return redirect(url_for('data_platform_user_bp.login_openid_select_zone'))

@openid_login_required
@data_platform_user_bp.route('/user/openid/choose_zone', methods=["GET", "POST"])
def login_openid_select_zone():
    if request.method == 'GET':
        last_zone_name=''

        if 'zone' in session:
            last_zone_name = session['zone']
        
        projects, perms = current_user_projects()

        # Filter zones
        zones = [] # All visible zones (many in case user is admin)
        my_zones = [] # Zones in which the user exist (user must be on a project that is not archived)
        for project in projects:
            if 'zone' not in project:
                continue
            if project['zone'] not in zones:
                zones.append(project['zone'])
            if project['my_role'] != '' and not project['archived'] and project['zone'] not in my_zones:
                my_zones.append(project['zone'])

        return render_template('user/login_openid_select_zone.html.j2', 
            projects=projects, 
            zones=zones,
            my_zones=my_zones,
            last_zone_name=last_zone_name,
            admin=('operator' in perms or 'admin' in perms),
        )

    zone = request.form.get('irods_zone')

    user_name = session['openid_username']
    connection_info = irods_connection_info(zone=zone, username=user_name)
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

        irods_session_pool.irods_node_logins += [{'userid': user_name, 'zone': irods_session.zone, 'login_time': datetime.now(), 'user_name': session['openid_user_name'] if 'openid_user_name' in session else ''} ]
        logging.info(f"User {irods_session.username}, zone {irods_session.zone} logged in")

    except Exception as e:
        print(e)
        flash('Could not create iRODS session', category='danger')
        return render_template('user/login_openid_select_zone.html.j2', zones=zones)

    if request.form.get('submit') == 'Connection information':
        return redirect(url_for('data_platform_user_bp.connection_info'))
    
    collection = request.form.get('collection')
    if collection:
        return redirect(url_for('browse_bp.collection_browse', collection=collection.lstrip('/')))

    return redirect(url_for('index'))

@data_platform_user_bp.route("/data-platform/connection-info", methods=["GET"])
def connection_info():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}
    jobid = current_zone_jobid()
    response = requests.get(
        f"{API_URL}/v1/irods/zones/{jobid}/connection_info", headers=header
    )
    response.raise_for_status()

    info = response.json()
    
    if "-hpc-" in jobid:
        # icts-p-hpc-irods-instance
        parts = jobid.split('-', 5)

        info['hpc-irods-setup-zone'] = parts[4]

        if parts[1] != 'p':
            info['hpc-irods-setup-zone'] += "-" + parts[1]
    
    info['expiration'] = datetime.strptime(info['expiration'], '%Y-%m-%dT%H:%M:%S%z')

    return render_template(
        "user/connection_info.html.j2", 
        info=info,
        setup_json={
            'linux': json.dumps(info['irods_environment'], indent=4),
            'windows': json.dumps({**info['irods_environment'], 'irods_authentication_scheme': 'PAM', 'irods_authentication_uid': 1000}, indent=4),
        }
    )