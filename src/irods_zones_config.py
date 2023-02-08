import os
import ssl
import requests

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

DEFAULT_IRODS_PARAMETERS = {
    "port": 1247,
    "irods_authentication_scheme": "PAM",
    "irods_ssl_ca_certificate_file": "",
    "irods_ssl_verify_server": "cert",
    "irods_default_resource": "default",
}

ssl_context = ssl.create_default_context(
    purpose=ssl.Purpose.SERVER_AUTH, cafile=None, capath=None, cadata=None
)

DEFAULT_SSL_PARAMETERS = {
    "client_server_negotiation": "request_server_negotiation",
    "client_server_policy": "CS_NEG_REQUIRE",
    "encryption_algorithm": "AES-256-CBC",
    "encryption_key_size": 32,
    "encryption_num_hash_rounds": 16,
    "encryption_salt_size": 8,
    "ssl_context": ssl_context,
}

# Dict of irods zones
irods_zones = {
    "kuleuven_tier1_pilot": {
        "jobid": "icts-p-hpc-irods-tier1-pilot",
        "parameters": {
            "host": "irods.hpc.kuleuven.be",
            "zone": "kuleuven_tier1_pilot",
        },
        "ssl_settings": {},
        "admin_users": ["vsc33436", "x0116999", "vsc31987"],
        'logo': 'vsc-combi.webp', # path in static folder
        'splash_image' : 'portal2.jpg',
    },
    "set": {
        "jobid": "icts-p-lnx-irods-set",
        "parameters": {
            "host": "set.irods.icts.kuleuven.be",
            "zone": "set",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "gbiomed": {
        "jobid": "icts-p-lnx-irods-gbiomed",
        "parameters": {
            "host": "gbiomed.irods.icts.kuleuven.be",
            "zone": "gbiomed",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "gbiomed_eximious": {
        "jobid": "icts-p-lnx-irods-gbiomed-eximious",
        "parameters": {
            "host": "gbiomed-eximious.irods.icts.kuleuven.be",
            "zone": "gbiomed_eximious",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "gbiomed_fbi": {
        "jobid": "icts-p-lnx-irods-gbiomed-fbi",
        "parameters": {
            "host": "gbiomed-fbi.irods.icts.kuleuven.be",
            "zone": "gbiomed_fbi",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "ghum": {
        "jobid": "icts-p-lnx-irods-ghum",
        "parameters": {
            "host": "ghum.irods.icts.kuleuven.be",
            "zone": "ghum",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "icts_demo": {
        "jobid": "icts-t-lnx-irods-demo",
        "parameters": {
            "host": "demo.irods.t.icts.kuleuven.be",
            "zone": "icts_demo",
        },
        "ssl_settings": {},
        "admin_users": ["u0123318", "x0116999"],
    },
    "kuleuven_tier1_poc": {
        "admin_users": ["vsc33436", "x0116999"],
        'logo': 'vsc-combi.webp', # path in static folder
        'splash_image' : 'portal2.jpg',
    }
}

