import os
import logging
import requests

from flask import current_app, session, redirect, url_for, g

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not API_TOKEN:
    logging.warn(f"No COZ API token, module data_platform will not work")

def openid_login_required(func):
  def inner(*args, **kwargs):
    if 'openid_username' not in session or 'openid_provider' not in session:
        return redirect(url_for(current_app.config["MANGO_LOGIN_ACTION"]))

    return func(*args, **kwargs)
  
  return inner

def update_zone_info(irods_zones):
    """
    Refresh zone information
    Update the irods_zone information with the zones retrieved from the data platform api.
    """

    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.get(f"{API_URL}/v1/irods/zones", headers=header)
    response.raise_for_status()

    zones = {}

    for zone_info in response.json():
        zones[zone_info["zone"]] = {
            "jobid": zone_info["jobid"],
            "parameters": {
                "host": zone_info["fqdn"],
                "zone": zone_info["zone"],
            },
            "ssl_settings": {},
            #"admin_users": ["u0123318", "vsc33436", "x0116999"],
        }

        if zone_info["zone"] in irods_zones:
            extra_zone_configs = [extra_zone_config for extra_zone_config in irods_zones[zone_info["zone"]].keys() if extra_zone_config not in ['job_id', 'parameters', 'ssl_settings']]
            for extra_zone_config in extra_zone_configs:
                zones[zone_info["zone"]][extra_zone_config] = irods_zones[zone_info["zone"]][extra_zone_config]

    irods_zones.clear()
    irods_zones.update(zones)


def current_user_api_token():
    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.post(
        f"{API_URL}/v1/token",
        json={"username": session['openid_username'], "permissions": ["user"], "lookup_user_permissions": True},
        headers=header,
    )
    response.raise_for_status()

    payload = response.json()

    return payload["token"], payload["permissions"]

def current_user_projects():
    # Retrieve projects
    token, perms = current_user_api_token()
    header = {"Authorization": "Bearer " + token}
    response = requests.get(
        f"{API_URL}/v1/projects", headers=header
    )
    response.raise_for_status()

    projects = response.json()

    # Get zones
    zones = current_app.config['irods_zones']

    # Map projects to zones
    for project in projects:
        project['my_role'] = ''

        for m in project['members']:
            if m['username'] == session['openid_username']:
                project['my_role'] = m['role']

        if project["platform"] != "irods":
            continue
    
        jobid = ''

        for opt in project["platform_options"]:
            if opt["key"] == "zone-jobid":
                jobid = opt["value"]
        
        for zone in zones:
            if zones[zone]['jobid'] == jobid:
                project["zone"] = zone
    
    return projects, perms

def current_zone_jobid():
    return current_app.config['irods_zones'][g.irods_session.zone]["jobid"]

# Dict of openid providers
openid_providers = {
    "kuleuven": {
        "label": "KU Leuven",
        "client_id": os.environ.get("OIDC_CLIENT_ID", ""),
        "secret": os.environ.get("OIDC_SECRET", ""),
        "issuer_url": os.environ.get("OIDC_ISSUER_URL", ""),
        "auto_pick_on_host": "mango.kuleuven.be",
    },
    "vsc": {
        "label": "VSC",
        "client_id": "blub",
        "secret": "blub",
        "issuer_url": "https://auth.vscentrum.be",
        "auto_pick_on_host": "mango.vscentrum.be",
    },
}