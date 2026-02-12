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

# Definition of openid providers
openid_providers = {
    "kuleuven": {
        "client_id": os.environ.get("OIDC_CLIENT_ID", ""),
        "secret": os.environ.get("OIDC_SECRET", ""),
        "issuer_url": os.environ.get("OIDC_ISSUER_URL", ""),
        "scopes": ["openid", "eduPersonEntitlement"],
    },
    "vsc": {
        "client_id": "mango.vscentrum.be",
        "secret": "blub",
        "issuer_url": "https://auth.vscentrum.be",
        "scopes": ["openid"],
    },
    "eduteams": {
        "client_id": os.environ.get("EDUTEAMS_CLIENT_ID", ""),
        "secret": os.environ.get("EDUTEAMS_SECRET", ""),
        "issuer_url": os.environ.get("EDUTEAMS_ISSUER_URL", ""),
        "scopes": ["openid", "profile", "aarc"],
    }
}

# Definition of tenants (for data-platform-api)
portals = {
    "kuleuven": {
        "label": "ManGO Portal - KU Leuven authentication",
        "tenant": "kuleuven",
        "openid_provider": "kuleuven",
        "auto_pick_on_host": "mango.kuleuven.be",
        "allow_switch_tenant_to": ["vsc-as-kuleuven"],
    },
    "kuleuven-as-vsc": {
        "label": "ManGO Portal - VSC authentication",
        "tenant": "kuleuven",
        "openid_provider": "vsc",
        "allow_switch_tenant_to": ["vsc"],
    },
    "kuleuven-cold": {
        "label": "Frigo Portal - KU Leuven authentication",
        "tenant": "kuleuven-cold",
        "openid_provider": "kuleuven",
        "auto_pick_on_host": "frigo.kuleuven.be",
        "allow_switch_tenant_to": [],
    },
    "vsc": {
        "label": "Tier1 Data Portal - VSC authentication",
        "tenant": "vsc",
        "openid_provider": "vsc",
        "auto_pick_on_host": "mango.vscentrum.be",
        "allow_switch_tenant_to": ["kuleuven-as-vsc"],
    },
    "vsc-as-kuleuven": {
        "label": "Tier1 Data Portal - KU Leuven authentication",
        "tenant": "vsc",
        "openid_provider": "kuleuven",
        "allow_switch_tenant_to": ["kuleuven"],
    },
}

oidc_clients = {}

# Function to retrieve client for openid providers
def openid_get_client(openid_provider):
    if openid_provider in oidc_clients:
        return oidc_clients[openid_provider]

    provider_config = openid_providers[openid_provider]

    client = Client(client_authn_method=CLIENT_AUTHN_METHOD)
    issuer_url = provider_config['issuer_url']
    provider_info = client.provider_config(issuer_url)
    client_reg = RegistrationResponse(client_id=provider_config['client_id'], client_secret=provider_config['secret'])
    client.store_registration_info(client_reg)

    oidc_clients[openid_provider] = client

    return client

def openid_login_required(func):
  @wraps(func)
  def inner(*args, **kwargs):
    if 'openid_session' not in session:
        session['openid_redirect'] = request.full_path
        return redirect(url_for("data_platform_user_bp.login_openid"))
    
    s = Session(session['openid_session'])

    if s.should_refresh():
        try:
            s.refresh()
            session['openid_session'] = dict(s)
        except Exception as e:
            print(e)

    if not s.valid():
        session['openid_redirect'] = request.full_path
        return redirect(url_for("data_platform_user_bp.login_openid"))

    # No permissions means the user is not entitled to use the data platform api, redirect to entitlement required page
    if not s.permissions:
        return redirect(url_for('data_platform_user_bp.entitlement_required'))
    
     # Set session as global variable
    g.dpa = s

    # Update the irods zone information
    update_zone_info(current_app.config['irods_zones'], g.dpa.data_platform_token)

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
            extra_zone_configs = [extra_zone_config for extra_zone_config in irods_zones[zone_info["zone"]].keys() if extra_zone_config not in ['jobid', 'parameters', 'ssl_settings']]
            for extra_zone_config in extra_zone_configs:
                zones[zone_info["zone"]][extra_zone_config] = irods_zones[zone_info["zone"]][extra_zone_config]

    irods_zones.clear()
    irods_zones.update(zones)

def current_user_projects():
    # Retrieve projects
    response = requests.get(
        f"{API_URL}/v2/{g.dpa.tenant}/projects", headers=g.dpa.data_platform_headers
    )
    response.raise_for_status()

    projects = response.json()

    # Get zones
    zones = current_app.config['irods_zones']

    # Map projects to zones
    for project in projects:
        project['activated'] = not project['archived'] or not project['valid_after'] or datetime.strptime(project['valid_after'], '%Y-%m-%d') < datetime.now()

        project['my_role'] = ''

        for m in project['members']:
            if m['username'] == Session(session['openid_session']).username:
                project['my_role'] = m['role']

        if not project["platform"].startswith("irods"):
            continue
    
        jobid = ''

        for opt in project["platform_options"]:
            if opt["key"] == "zone-jobid":
                jobid = opt["value"]
        
        for zone in zones:
            if 'jobid' in zones[zone] and zones[zone]['jobid'] == jobid:
                project["zone"] = zone
    
    return projects

def current_zone_jobid():
    return current_app.config['irods_zones'][g.irods_session.zone]["jobid"]

class Session(dict):
    def __init__(self, portal):
        dict.__init__(self)

        if type(portal) is dict:
            self.update(**portal)
        else:
            self['portal'] = portal

    @property
    def username(self):
        if 'preferred_username' not in self['user_info']:
            return None
        
        return self['user_info']['preferred_username']
    
    @property
    def name(self):
        if 'name' not in self['user_info']:
            return None

        return self['user_info']['name']
    
    @property
    def email(self):
        if 'email' not in self['user_info']:
            return None

        return self['user_info']['email']
    
    @property
    def access_token(self):
        return self['access_token']
    
    @property
    def data_platform_token(self):
        return self['data_platform_token']

    @property
    def portal(self):
        return self['portal']
    
    @property
    def provider(self):
        return portals[self['portal']]['openid_provider']
    
    @property
    def tenant(self):
        return portals[self['portal']]['tenant']
    
    @property
    def permissions(self):        
        if 'permissions' not in self:
            return []
        
        return self['permissions']
    
    @property
    def data_platform_headers(self):
        headers = {"Authorization": "Bearer " + self.data_platform_token}

        if 'drop_permissions' not in self:
            headers['X-Sudo'] = 'true'

        return headers

    def valid(self):
        if 'expiry' not in self:
            return False

        return self['expiry'] > datetime.now().timestamp() + 30

    def should_refresh(self):
         if'expiry' not in self or 'refresh_token' not in self or self['refresh_token'] is None:
            return False
        
         return self['expiry'] < datetime.now().timestamp() + 90
        
    def refresh(self):
        request_args = {
            'grant_type': 'refresh_token',
            'refresh_token': self['refresh_token'],
            "redirect_uri": self.redirect_uri,
        }

        client = openid_get_client(self.provider)

        token_resp = client.do_access_token_refresh(
            request_args=request_args, 
            authn_method='client_secret_basic',
            token=Token(resp={'refresh_token': self['refresh_token']}),
        )

        self['access_token'] = token_resp['access_token']
        self['refresh_token'] = None
        if 'refresh_token' in token_resp:
            self['refresh_token'] = token_resp['refresh_token']
        self['expiry'] = token_resp['id_token']['exp']

    def login(self):
        client = openid_get_client(self.provider)

        if 'openid_session' in session:
            del session["openid_session"]
        session["openid_state"] = rndstr()
        session["openid_nonce"] = rndstr()
        args = {
            "response_type": "code",
            "scope": openid_providers[self.provider]["scopes"],
            "nonce": session["openid_nonce"],
            "redirect_uri": self.redirect_uri,
            "state": session["openid_state"]
        }

        auth_req = client.construct_AuthorizationRequest(request_args=args)
        auth_uri = auth_req.request(client.authorization_endpoint)

        return redirect(auth_uri)
    
    def from_callback(self):
        client = openid_get_client(self.provider)

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
        self['access_token'] = token_resp['access_token']
        self['refresh_token'] = None
        if 'refresh_token' in token_resp:
            self['refresh_token'] = token_resp['refresh_token']
        self['expiry'] = token_resp['id_token']['exp']
        self['subject'] = token_resp['id_token']['sub']
        self['data_platform_token'] = self['access_token']

        print("Retrieving permissions for user")
        #print(self['user_info'])
        #print(self['access_token'])

        response = requests.get(f"{API_URL}/v2/{self.tenant}/whoami", headers=self.data_platform_headers)

        if response.status_code == 402:
            self['permissions'] = []
            return self

        response.raise_for_status()
        data = response.json()
        self['permissions'] = data['claims']['permissions']

        if 'preferred_username' not in self['user_info']:
            self['user_info']['preferred_username'] = data['claims']['user']['username']

        return self
    
    @property
    def redirect_uri(self):
        redirect_base = os.environ.get("OPENID_REDIRECT_BASE", f"https://{request.host}") 

        return f"{redirect_base}/user/openid/callback/{self.portal}"
    
    def drop_permissions(self):
        self['drop_permissions'] = True

        response = requests.get(f"{API_URL}/v2/{self.tenant}/whoami", headers=self.data_platform_headers)
        if response.status_code == 402:
            self['permissions'] = []
            
            return self

        response.raise_for_status()
        self['permissions'] = response.json()['claims']['permissions']

        return self

    def impersonate(self, username):
        # Retrieve a token for the specified username.
        payload = {
            'username': username,
            'permissions': ['user'],
        }

        headers = {"Authorization": "Bearer " + self.access_token, "X-Sudo": "true"}

        response = requests.post(
            f"{API_URL}/v2/{self.tenant}/token",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()

        self['data_platform_token'] = response.json()['token']

        if not 'orig_user_info' in self:
            self['orig_user_info'] = self['user_info'].copy()
        
        self['user_info']['preferred_username'] = username
        self['user_info']['name'] = self['orig_user_info']['name'] + " (impersonating " + username + ")"

        response = requests.get(f"{API_URL}/v2/{self.tenant}/whoami", headers=self.data_platform_headers)
        if response.status_code == 402:
            self['permissions'] = []
            
            return self

        response.raise_for_status()
        self['permissions'] = response.json()['claims']['permissions']

        return self
    
    def switch_portal(self, portal):
        self['portal'] = portal
        self['data_platform_token'] = self['access_token']

        if 'orig_user_info' in self:
            self['user_info'] = self['orig_user_info']
            del self['orig_user_info']

        if 'drop_permissions' in self:
            del self['drop_permissions']

        response = requests.get(f"{API_URL}/v2/{self.tenant}/whoami", headers=self.data_platform_headers)

        if response.status_code == 402:
            self['permissions'] = []
            return self

        response.raise_for_status()
        data = response.json()
        self['permissions'] = data['claims']['permissions']

        return self

# moved here from the main app/config: if the dataplatform plugin is loaded, it should take over the zones config
from app import app
update_zone_info(app.config["irods_zones"])
