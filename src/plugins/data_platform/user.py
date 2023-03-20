from datetime import datetime
import os
import requests
from requests.models import PreparedRequest
import json
from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    request,
    session,
    flash
)

from irods.session import iRODSSession
import irods_session_pool

from irods_zones_config import DEFAULT_IRODS_PARAMETERS, DEFAULT_SSL_PARAMETERS
from . import API_URL, openid_providers, openid_login_required, current_user_projects, current_user_api_token, current_zone_jobid, Session

import logging


data_platform_user_bp = Blueprint(
    "data_platform_user_bp", __name__, template_folder="templates"
)

def irods_connection_info(zone, username):
    token, _ = current_user_api_token()

    jobid = current_app.config['irods_zones'][zone]["jobid"]

    header = {"Authorization": "Bearer " + token}
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
            provider_config = openid_providers[openid_provider]
            if 'auto_pick_on_host' in provider_config and provider_config['auto_pick_on_host'] == request.host:
                return Session(openid_provider).login()

        last_openid_provider = ""
        if 'openid_provider' in session:
            last_openid_provider = session['openid_provider']

        return render_template('user/login_openid.html.j2', openid_providers=openid_providers, last_openid_provider=last_openid_provider)

    if request.method == 'POST':
        openid_provider = request.form.get('openid_provider')

        if openid_provider not in openid_providers:
            flash('Unknown openid provider', category='danger')
            return redirect(url_for('data_platform_user_bp.login_openid'))

        return Session(openid_provider).login()

@data_platform_user_bp.route('/user/openid/callback/<openid_provider>')
def login_openid_callback(openid_provider):
    """
    """

    if openid_provider not in openid_providers:
        flash('Unknown openid provider', category='danger')
        return render_template('user/login_openid.html.j2', openid_providers=openid_providers)

    s = Session(openid_provider).from_callback()

    if not s.valid():
        return redirect(url_for('data_platform_user_bp.login_openid'))

    # We are logged on
    session['openid_provider'] = openid_provider
    session['openid_session'] = dict(s)

    if 'openid_redirect' in session:
        return redirect(session.pop('openid_redirect'))

    return redirect(url_for('data_platform_user_bp.login_openid_select_zone'))


@data_platform_user_bp.route('/user/openid/choose_zone', methods=["GET", "POST"])
@openid_login_required
def login_openid_select_zone():
    if request.method == 'GET':
        last_zone_name=''

        if 'zone' in session:
            last_zone_name = session['zone']

        projects, perms = current_user_projects()

        # Filter zones
        zones = [] # All visible zones (many in case user is admin)
        my_zones = [] # Zones in which the user exist (user must be on a project that is not archived)
        other_platforms = []
        for project in projects:
            if not project['platform'].startswith('irods') and project['platform'] not in other_platforms:
                other_platforms.append(project['platform'])
            if 'zone' not in project:
                continue
            if project['zone'] not in zones:
                zones.append(project['zone'])
            if project['my_role'] != '' and not project['archived'] and project['zone'] not in my_zones:
                my_zones.append(project['zone'])

        sftp_host = "rdmsftp.icts.kuleuven.be"
        if "-q-" in API_URL:
            sftp_host = "rdmsftp.q.icts.kuleuven.be"
        if "-t-" in API_URL:
            sftp_host = "rdmsftp.t.icts.kuleuven.be"

        return render_template('user/login_openid_select_zone.html.j2',
            projects=projects,
            zones=zones,
            my_zones=my_zones,
            other_platforms=other_platforms,
            last_zone_name=last_zone_name,
            admin=('operator' in perms or 'admin' in perms),
            sftp_host=sftp_host,
        )

    zone = request.form.get('irods_zone')

    user_name = Session(session['openid_session']).username
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

        irods_session_pool.irods_node_logins += [{'userid': user_name, 'zone': irods_session.zone, 'login_time': datetime.now(), 'user_name': user_name} ]
        logging.info(f"User {irods_session.username}, zone {irods_session.zone} logged in")

    except Exception as e:
        print(e)
        flash('Could not create iRODS session', category='danger')
        return redirect(url_for('data_platform_user_bp.login_openid_select_zone'))

    if request.form.get('submit') == 'How to connect':
        return redirect(url_for('data_platform_user_bp.connection_info'))

    collection = request.form.get('collection')
    if collection:
        return redirect(url_for('browse_bp.collection_browse', collection=collection.lstrip('/')))

    return redirect(url_for('index'))

@data_platform_user_bp.route('/user/logout_openid', methods=["GET"])
def logout_openid():
    if 'openid_session' in session:
        del session['openid_session']

    if 'drop_data_platform_privileges' in session:
        del session['drop_data_platform_privileges']

    if 'userid' in session:
        del session['userid']

    return render_template('user/logout_openid.html.j2')

@data_platform_user_bp.route('/user/openid/drop_permissions', methods=["GET"])
@openid_login_required
def drop_permissions():
    s = Session(session['openid_session'])
    s.drop_permissions()
    session['openid_session'] = dict(s)

    return redirect(url_for('data_platform_user_bp.login_openid_select_zone'))

@data_platform_user_bp.route('/user/openid/impersonate', methods=["POST"])
@openid_login_required
def impersonate():
    s = Session(session['openid_session'])
    s.impersonate(request.form.get('username'))
    session['openid_session'] = dict(s)

    return redirect(url_for('data_platform_user_bp.login_openid_select_zone'))

@data_platform_user_bp.route("/data-platform/connection-info/modal/<zone>", methods=["GET"])
@openid_login_required
def connection_info_modal(zone):
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}
    jobid = current_app.config['irods_zones'][zone]["jobid"]
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

    sftp_host = "rdmsftp.icts.kuleuven.be"
    if "-q-" in jobid:
        sftp_host = "rdmsftp.q.icts.kuleuven.be"
    if "-t-" in jobid:
        sftp_host = "rdmsftp.t.icts.kuleuven.be"

    info['expiration'] = datetime.strptime(info['expiration'], '%Y-%m-%dT%H:%M:%S%z')

    setup_json={
        'linux': json.dumps(info['irods_environment'], indent=4),
        'windows': json.dumps({**info['irods_environment'], 'irods_authentication_scheme': 'PAM', 'irods_authentication_uid': 1000}, indent=4),
    }

    return render_template("user/connection_info_body.html.j2", info=info, setup_json=setup_json, sftp_host=sftp_host)

@data_platform_user_bp.route("/data-platform/connection-info", methods=["GET"])
@openid_login_required
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

        info['hpc-irods-setup-zone'] = '-'.join(parts[4:])

        if parts[1] != 'p':
            info['hpc-irods-setup-zone'] += "-" + parts[1]

    sftp_host = "rdmsftp.icts.kuleuven.be"
    if "-q-" in jobid:
        sftp_host = "rdmsftp.q.icts.kuleuven.be"
    if "-t-" in jobid:
        sftp_host = "rdmsftp.t.icts.kuleuven.be"

    info['expiration'] = datetime.strptime(info['expiration'], '%Y-%m-%dT%H:%M:%S%z')

    setup_json={
        'linux': json.dumps(info['irods_environment'], indent=4),
        'windows': json.dumps({**info['irods_environment'], 'irods_authentication_scheme': 'PAM', 'irods_authentication_uid': 1000}, indent=4),
    }

    return render_template("user/connection_info.html.j2", info=info, setup_json=setup_json, sftp_host=sftp_host)


@data_platform_user_bp.route('/data-platform/retrieve-token', methods=["GET", "POST"])
@openid_login_required
def local_client_retrieve_token_callback():
    if request.method == 'POST':
        redirect_uri = request.form.get('redirect_uri')
        irods_zone = request.form.get('irods_zone')

        if not redirect_uri.startswith('http://localhost:'):
            flash('Invalid redirect uri')
            return redirect(url_for("data_platform_user_bp.local_client_retrieve_token_callback"))

        response = requests.post(
            f"{API_URL}/v1/token/exchange",
            json={
                "id_token": Session(session['openid_session']).jwt_token,
                "drop_permissions": True,
            },
        )
        response.raise_for_status()

        payload = response.json()

        params = {
            'token': payload['token'],
            'irods_zone': irods_zone,
            'jobid': current_app.config['irods_zones'][irods_zone]["jobid"],
        }

        req = PreparedRequest()
        req.prepare_url(redirect_uri, params)
    
        return redirect(req.url)

    all_projects, _ = current_user_projects()

    projects = []
    zones = []
    for project in all_projects:
        if not project['platform'].startswith('irods'):
            continue
        if 'zone' not in project:
            continue
        if project['my_role'] == '' or project['archived']:
            continue
        if project['zone'] not in zones:
            zones.append(project['zone'])
        projects.append(project)

    return render_template('user/local_client_select_zone.html.j2',
        zones=zones,
        projects=projects,
        redirect_uri=request.args.get('redirect_uri'),
    )