import os
import logging
import requests
from datetime import datetime

from functools import wraps

from flask import current_app, session, redirect, url_for, g, request, flash

from oic.oic import Client, Token
from oic.utils.authn.client import CLIENT_AUTHN_METHOD
from oic.oic.message import RegistrationResponse, AuthorizationResponse

from oic import rndstr

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not os.environ.get("OIDC_SECRET", ""):
    logging.warn(f"No OIDC_SECRET, only VSC login will work")

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

openid_clients = {}

# Function to retrieve client for openid providers
def openid_get_client(openid_provider):
    if openid_provider in openid_clients:
        return openid_clients[openid_provider]

    provider_config = openid_providers[openid_provider]

    client = Client(client_authn_method=CLIENT_AUTHN_METHOD)
    issuer_url = provider_config['issuer_url']
    provider_info = client.provider_config(issuer_url)
    client_reg = RegistrationResponse(client_id=provider_config['client_id'], client_secret=provider_config['secret'])
    client.store_registration_info(client_reg)

    openid_clients[openid_provider] = client

    return client

def openid_login_required(func):
  @wraps(func)
  def inner(*args, **kwargs):
    if 'openid_session' not in session:
        return redirect(url_for(current_app.config["MANGO_LOGIN_ACTION"]))
    
    s = Session(session['openid_session'])

    s.refresh()

    if not s.valid():
        return redirect(url_for(current_app.config["MANGO_LOGIN_ACTION"]))

    return func(*args, **kwargs)
  
  return inner

def update_zone_info(irods_zones, token=API_TOKEN):
    """
    Refresh zone information
    Update the irods_zone information with the zones retrieved from the data platform api.
    """

    if not token:
        logging.warn(f"No COZ API token, not updating zones")

        return

    header = {"Authorization": "Bearer " + token}
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
    response = requests.post(
        f"{API_URL}/v1/token/exchange",
        json={"id_token": Session(session['openid_session']).jwt_token},
    )
    response.raise_for_status()

    payload = response.json()

    update_zone_info(current_app.config['irods_zones'], payload["token"])

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
            if m['username'] == Session(session['openid_session']).username:
                project['my_role'] = m['role']

        if project["platform"] != "irods":
            continue
    
        jobid = ''

        for opt in project["platform_options"]:
            if opt["key"] == "zone-jobid":
                jobid = opt["value"]
        
        for zone in zones:
            if 'jobid' in zones[zone] and zones[zone]['jobid'] == jobid:
                project["zone"] = zone
    
    return projects, perms

def current_zone_jobid():
    return current_app.config['irods_zones'][g.irods_session.zone]["jobid"]

class Session(dict):
    def __init__(self, provider):
        dict.__init__(self)

        if type(provider) is dict:
            self.update(**provider)
        else:
            self['provider'] = provider

    @property
    def username(self):
        return self['user_info']['preferred_username']
    
    @property
    def name(self):
        return self['user_info']['name']
    
    @property
    def email(self):
        return self['user_info']['email']
    
    @property
    def jwt_token(self):
        return self['jwt_token']

    def valid(self):
        if 'expiry' not in self:
            return False
        print(self['expiry'])
        return self['expiry'] - 30 > datetime.now().timestamp()
    
    def refresh(self):
        if 'refresh_token' not in self or self['refresh_token'] is None:
            return

        request_args = {
            'grant_type': 'refresh_token',
            'refresh_token': self['refresh_token'],
            "redirect_uri": self.redirect_uri,
        }

        client = openid_get_client(self['provider'])

        token_resp = client.do_access_token_refresh(
            request_args=request_args, 
            authn_method='client_secret_basic',
            token=Token(resp={'refresh_token': self['refresh_token']}),
        )

        self['jwt_token'] = token_resp['id_token_jwt']
        self['access_token'] = token_resp['access_token']
        self['refresh_token'] = None
        if 'refresh_token' in token_resp:
            self['refresh_token'] = token_resp['refresh_token']
        self['expiry'] = token_resp['id_token']['exp']

    def login(self):
        client = openid_get_client(self['provider'])

        session.clear()
        session["openid_state"] = rndstr()
        session["openid_nonce"] = rndstr()
        args = {
            "response_type": "code",
            "scope": ["openid"],
            "nonce": session["openid_nonce"],
            "redirect_uri": self.redirect_uri,
            "state": session["openid_state"]
        }

        auth_req = client.construct_AuthorizationRequest(request_args=args)
        auth_uri = auth_req.request(client.authorization_endpoint)

        return redirect(auth_uri)
    
    def from_callback(self):
        client = openid_get_client(self['provider'])

        query_string = request.query_string.decode('utf-8')
        authn_resp = client.parse_response(AuthorizationResponse, info=query_string, sformat='urlencoded')

        if authn_resp["state"] != session.pop('openid_state'):
            flash('Invalid state', category='danger')
            return self  

        args = {
            "code": authn_resp["code"],
            "redirect_uri": self.redirect_uri,
        }
        token_resp = client.do_access_token_request(state=authn_resp["state"], request_args=args, authn_method="client_secret_basic")

        id_token = token_resp['id_token']

        if id_token['nonce'] != session.pop('openid_nonce'):
            flash('Invalid nonce', category='danger')
            return self

        user_info = client.do_user_info_request(state=authn_resp["state"])
        if user_info['sub'] != id_token['sub']:
            flash('The \'sub\' of userinfo does not match \'sub\' of ID Token.', category='danger')
            return self
        
        self['user_info'] = user_info._dict

        self['jwt_token'] = token_resp['id_token_jwt']
        self['access_token'] = token_resp['access_token']
        self['refresh_token'] = None
        if 'refresh_token' in token_resp:
            self['refresh_token'] = token_resp['refresh_token']
        self['expiry'] = token_resp['id_token']['exp']

        return self
    
    @property
    def redirect_uri(self):
        redirect_base = os.environ.get("OPENID_REDIRECT_BASE", f"https://{request.host}") 

        return f"{redirect_base}/user/openid/callback/{self['provider']}"