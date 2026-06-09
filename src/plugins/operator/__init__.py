import datetime
import logging
import os
import time

from dateutil.parser import parse
from irods.session import iRODSSession

import requests

from threading import Thread, Event

API_URLS = {
    "p": "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be",
    "q": "https://icts-q-coz-data-platform-api.cloud.q.icts.kuleuven.be",
    "t": "https://icts-t-coz-data-platform-api.cloud.t.icts.kuleuven.be",
}
API_URL = os.environ.get("API_URL", API_URLS["p"])
API_TOKEN = os.environ.get("API_TOKEN", "")
TENANT = os.environ.get("TENANT", "kuleuven")

zone_operator_sessions = {}
failed_operator_sessions = {}


def _get_zone_session_parameters(zone: str, tenant: str, token: str) -> dict:
    header = {"Authorization": "Bearer " + token}

    response = requests.get(f"{API_URL}/v2/{tenant}/irods/zones", headers=header)
    response.raise_for_status()

    mapping = {zone["zone"]: zone["jobid"] for zone in response.json()}
    jobid = mapping.get(zone)
    if jobid is None:
        raise ValueError(
            "This zone name is not valid, check that you have the url and token for the right tier!"
        )
    response = requests.post(
        f"{API_URL}/v2/{tenant}/irods/zone/{jobid}/connection-info",
        headers=header,
        json={"username": "operator"},
    )
    response.raise_for_status()

    return response.json()


def get_zone_session_parameters(zone: str, tenant: str = TENANT) -> dict:
    if not API_URL or not API_TOKEN:
        raise ValueError("Cannot access zones without URL and token")

    try:
        session_parameters = _get_zone_session_parameters(zone, tenant, API_TOKEN)
    except Exception:
        """If it doesn't work, try to use existing token to get a new one,
        e.g. to change from one tenant to another."""
        token_response = requests.post(
            f"{API_URL}/v2/{TENANT}/token",
            headers={"Authorization": "Bearer " + API_TOKEN},
            json={"permissions": ["operator", "user"], "tenant": tenant},
        )
        token_response.raise_for_status()
        token = token_response.json()
        session_parameters = _get_zone_session_parameters(zone, tenant, token["token"])

    return session_parameters


def is_zone_operator_session_valid(key: str) -> bool:
    global zone_operator_sessions
    if (
        key in zone_operator_sessions
        and zone_operator_sessions[key].expiration > datetime.datetime.now()
    ):
        # check if the session can access the zone collection
        try:
            operator_session: iRODSSession = zone_operator_sessions[key]
            operator_session.collections.get(f"/{operator_session.zone}")
            return True
        except Exception:
            del zone_operator_sessions[key]
    return False


def get_zone_operator_session(
    zone: str, client_user: str | None = None, tenant: str = "kuleuven"
) -> iRODSSession:
    global zone_operator_sessions
    key = f"{zone}_{client_user}" if client_user else zone
    if is_zone_operator_session_valid(key):
        return zone_operator_sessions[key]
    # so not valid
    # use the API to get login parameters and create a session
    if not API_URL:
        raise ValueError("API URL is missing")
    if not API_TOKEN:
        raise ValueError("API Token is missing")
    session_parameters = get_zone_session_parameters(zone, tenant)
    if client_user:
        # irods_user_name remains 'operator'; client_user indicates whether we impersonate
        session_parameters["irods_environment"]["client_user"] = client_user

    logging.info(f"Requested operator info for {key}")

    irods_session = iRODSSession(
        **session_parameters["irods_environment"],
        password=session_parameters["token"],
    )

    # set the expiration time (4h) a bit lower than the real one to compensate running time and register it on the session object
    irods_session.expiration = parse(  # type: ignore
        session_parameters["expiration"], ignoretz=True
    ) - datetime.timedelta(minutes=20)
    zone_operator_sessions[key] = irods_session
    return zone_operator_sessions[key]


def remove_zone_operator_session(key: str) -> bool:
    global zone_operator_sessions
    if key in zone_operator_sessions:
        del zone_operator_sessions[key]
        return True
    return False


def set_credentials(token: str = API_TOKEN, tier: str = "p"):
    global API_TOKEN
    global API_URL
    API_TOKEN = token or os.getenv("API_TOKEN", "")
    API_URL = API_URLS.get(tier, API_URL)


class OperatorSessionCleanupThread(Thread):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop = Event()
        self.daemon = True
        self.start_time = datetime.datetime.now()
        self.heartbeat_time = time.time()

    def stop(self):
        self._stop.set()

    def stopped(self):
        return self._stop.is_set()

    def run(self):
        global zone_operator_sessions
        while True:
            if self.stopped():
                return
            logging.info(f"Checking {len(zone_operator_sessions)} operator sessions")
            for key in zone_operator_sessions.keys():
                if not is_zone_operator_session_valid(key):
                    logging.info(f"Removed invalid zone operator session for {key}")
            time.sleep(120)


cleanup_old_sessions_thread = OperatorSessionCleanupThread()
cleanup_old_sessions_thread.start()
