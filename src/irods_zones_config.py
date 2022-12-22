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
        "admin_users": ["vsc33436", "x0116999"],
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


def refresh_zone_info():
    """
    Refresh zone information
    Update the irods_zone information with the zones retrieved from the data platform api.
    """

    if not API_URL or not API_TOKEN:
        return

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


# TODO: only present relevant zones for a user
def zones_for_user_lnx(username):
    zones = []

    for zone, info in irods_zones.items():
        if "-lnx-" in info["jobid"]:
            zones.append(zone)

    return zones


# TODO: only present relevant zones for a user
def zones_for_user_vsc(username):
    zones = []

    for zone, info in irods_zones.items():
        if "-hpc-" in info["jobid"]:
            zones.append(zone)

    return zones


def irods_connection_info(login_method, zone, username, password=None):
    """
    Callback to retrieve connection information for a certain zone and username.
    If basic authentication is used, the password is passed as third argument.
    If openid authentication is used, the password will be None.
    """

    parameters = DEFAULT_IRODS_PARAMETERS.copy()
    ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
    parameters.update(irods_zones[zone]["parameters"])
    ssl_settings.update(irods_zones[zone]["ssl_settings"])

    if login_method == "openid":
        jobid = irods_zones[zone]["jobid"]

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

        parameters.update(info["irods_environment"])
        password = info["token"]

    return {
        "parameters": parameters,
        "ssl_settings": ssl_settings,
        "password": password,
    }


# Refresh zone information from api
refresh_zone_info()

# Dict of openid providers, can be empty
openid_providers = {
    "kuleuven": {
        "label": "KU Leuven",
        "client_id": os.environ.get("OIDC_CLIENT_ID", ""),
        "secret": os.environ.get("OIDC_SECRET", ""),
        "issuer_url": os.environ.get("OIDC_ISSUER_URL", ""),
        "zones_for_user": zones_for_user_lnx,
    },
    "vsc": {
        "label": "VSC",
        "client_id": "blub",
        "secret": "blub",
        "issuer_url": "https://auth.vscentrum.be",
        "zones_for_user": zones_for_user_vsc,
    },
}
