import os
import ssl
import requests

DEFAULT_IRODS_PARAMETERS = {
    'port': 1247,
    'irods_authentication_scheme': 'PAM',
    'irods_ssl_ca_certificate_file': '',
    'irods_ssl_verify_server': 'cert',
    'irods_default_resource': 'default'
}

ssl_context = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=None, capath=None, cadata=None)

DEFAULT_SSL_PARAMETERS = {
    'client_server_negotiation': 'request_server_negotiation',
    'client_server_policy': 'CS_NEG_REQUIRE',
    'encryption_algorithm': 'AES-256-CBC',
    'encryption_key_size': 32,
    'encryption_num_hash_rounds': 16,
    'encryption_salt_size': 8,
    'ssl_context': ssl_context
}

# Dict of openid providers, can be empty
openid_providers = {
    'kuleuven': {
        'label': 'KU Leuven',
        'client_id': os.environ.get('OIDC_CLIENT_ID', ''),
        'secret': os.environ.get('OIDC_SECRET', ''),
        'issuer_url': os.environ.get('OIDC_ISSUER_URL', ''),
        'zones_for_user': lambda username : ['set', 'gbiomed', 'gbiomed_eximious', 'gbiomed_fbi', 'ghum', 'icts_demo']
    },
    'vsc': {
        'label': 'VSC',
        'client_id': 'blub',
        'secret': 'blub',
        'issuer_url': 'https://auth.vscentrum.be',
        'zones_for_user': lambda username : ['kuleuven_tier1_pilot']
    },
}

# Dict of irods zones
irods_zones = {
    'kuleuven_tier1_pilot': {
        'jobid': 'icts-p-hpc-irods-tier1-pilot',
        'parameters' : {
            'host': 'irods.hpc.kuleuven.be',
            'zone': 'kuleuven_tier1_pilot',
        },
        'ssl_settings' : {},
        'admin_users': ['vsc33436', 'x0116999']
    },
    'set': {
        'jobid': 'icts-p-lnx-irods-set',
        'parameters' : {
            'host': 'set.irods.icts.kuleuven.be',
            'zone': 'set',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
    'gbiomed' : {
        'jobid': 'icts-p-lnx-irods-gbiomed',
        'parameters' : {
            'host': 'gbiomed.irods.icts.kuleuven.be',
            'zone': 'gbiomed',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
    'gbiomed_eximious' : {
        'jobid': 'icts-p-lnx-irods-gbiomed-eximious',
        'parameters' : {
            'host': 'gbiomed-eximious.irods.icts.kuleuven.be',
            'zone': 'gbiomed_eximious',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
    'gbiomed_fbi' : {
        'jobid': 'icts-p-lnx-irods-gbiomed-fbi',
        'parameters' : {
            'host': 'gbiomed-fbi.irods.icts.kuleuven.be',
            'zone': 'gbiomed_fbi',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
    'ghum' : {
        'jobid': 'icts-p-lnx-irods-ghum',
        'parameters' : {
            'host': 'ghum.irods.icts.kuleuven.be',
            'zone': 'ghum',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
    'icts_demo' : {
        'jobid': 'icts-t-lnx-irods-demo',
        'parameters' : {
            'host': 'demo.irods.t.icts.kuleuven.be',
            'zone': 'icts_demo',
        },
        'ssl_settings' : {},
        'admin_users': ['u0123318', 'x0116999']
    },
}

# Callback to retrieve connection information for a certain zone and username.
# If basic authentication is used, the password is passed as third argument.
# If openid authentication is used, the password will be None.
def irods_connection_info(login_method, zone, username, password=None):
    if login_method == "openid":
        password = retrieve_password(zone, username)

    parameters = DEFAULT_IRODS_PARAMETERS.copy()
    ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
    parameters.update(irods_zones[zone]['parameters'])
    ssl_settings.update(irods_zones[zone]['ssl_settings'])
    
    return {
        'parameters': parameters,
        'ssl_settings': ssl_settings,
        'password': password,
    }



def api_url(jobid):
    if 'icts-p-' in jobid:
        return f'https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be'
    elif 'icts-q-' in jobid:
        return f'https://icts-q-coz-data-platform-api.cloud.q.icts.kuleuven.be'
    else:
        return f'https://icts-t-coz-data-platform-api.cloud.t.icts.kuleuven.be'

def retrieve_password(zone, username):
    jobid = irods_zones[zone]['jobid']

    api_base = api_url(jobid)

    header = {'Authorization': 'Bearer ' + os.environ.get('API_TOKEN', '')}
    response = requests.post(f'{api_base}/v1/token', json={'username': username, 'permissions': ['user']}, headers=header)
    response.raise_for_status()

    user_api_token = response.json()['token']

    header = {'Authorization': 'Bearer ' + user_api_token}
    response = requests.get(f'{api_base}/v1/irods/zones/{jobid}/connection_info', headers=header)
    response.raise_for_status()

    return response.json()['token']
