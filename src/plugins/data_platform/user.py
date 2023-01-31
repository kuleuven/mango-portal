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
    flash,
)

from irods_zones_config import irods_zones
from . import API_URL, API_TOKEN

data_platform_user_bp = Blueprint(
    "data_platform_bp", __name__, template_folder="templates"
)

def current_user_api_token():
    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.post(
        f"{API_URL}/v1/token",
        json={"username": g.irods_session.username, "permissions": ["user"]},
        headers=header,
    )
    response.raise_for_status()

    return response.json()["token"]

def current_zone_jobid():
    return irods_zones[g.irods_session.zone]["jobid"]

@data_platform_user_bp.route("/data-platform/connection-info", methods=["GET"])
def connection_info():
    header = {"Authorization": "Bearer " + current_user_api_token()}
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

    view_template = "connection_info.html.j2"
    return render_template(
        view_template, 
        info=info,
        setup_json={
            'linux': json.dumps(info['irods_environment'], indent=4),
            'windows': json.dumps({**info['irods_environment'], 'irods_authentication_uid': 1000}, indent=4),
        }
    )
