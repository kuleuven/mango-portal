import os
import logging
import requests

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not API_TOKEN:
    logging.warn(f"No COZ API token, module data_platform will not work")

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

# TODO: only present relevant zones for a user
def zones_for_user_lnx(irods_zones, username):
    zones = []

    for zone, info in irods_zones.items():
        if "-lnx-" in info["jobid"]:
            zones.append(zone)

    return zones


# TODO: only present relevant zones for a user
def zones_for_user_vsc(irods_zones, username):
    zones = []

    for zone, info in irods_zones.items():
        if "-hpc-" in info["jobid"]:
            zones.append(zone)

    return zones

# Dict of openid providers
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