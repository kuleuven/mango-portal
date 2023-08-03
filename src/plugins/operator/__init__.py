import os, logging, datetime, time
from irods.session import iRODSSession
import irods_zones_config
import requests
from threading import Lock, Thread, Event

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not API_TOKEN:
    logging.warn(f"No COZ API token, module group admin will not work")

zone_operator_sessions = {}
failed_operator_sessions = {}

def get_operator_session_params_via_api(zone: str):
    if not API_URL or not API_TOKEN or not zone in irods_zones_config.irods_zones:
        return False
    jobid = irods_zones_config.irods_zones[zone]["jobid"]
    # /irods/zones/{id}/admin_token
    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.post(
        f"{API_URL}/v1/irods/zones/{jobid}/admin_token", headers=header
    )
    response.raise_for_status()
    return response.json()

def is_zone_operator_session_valid(zone : str) -> bool:
    global zone_operator_sessions
    if (
        zone in zone_operator_sessions
        and zone_operator_sessions[zone].expiration > datetime.datetime.now()
    ):
        # check if the session can access the zone collection
        try:
            operator_session : iRODSSession = zone_operator_sessions[zone]
            zone_home=operator_session.collections.get(f"/{zone}")
        except Exception as e:
            del zone_operator_sessions[zone]
            return False
        return True
    return False



def get_zone_operator_session(zone: str) -> iRODSSession:
    global zone_operator_sessions
    if is_zone_operator_session_valid(zone):
        return zone_operator_sessions[zone]
    # so not valid
    # use the API to get login parameters and create a session
    session_parameters = get_operator_session_params_via_api(zone)
    logging.info(f"Requested operator info for zone {zone}")
    try:
        irods_session = iRODSSession(
            **session_parameters["irods_environment"],
            password=session_parameters["token"],
        )
        # set the expiration time (4h) a bit lower than the real one to compensate running time and register it on the session object
        from dateutil.parser import parse

        irods_session.expiration = parse(
            session_parameters["expiration"], ignoretz=True
        ) - datetime.timedelta(minutes=20)
        zone_operator_sessions[zone] = irods_session
        return zone_operator_sessions[zone]
    except:
        logging.warn(f"Failed getting operator session for zone {zone}")
        return None


def remove_zone_operator_session(zone: str):
    if zone in zone_operator_sessions:
        del zone_operator_sessions[zone]
        return True
    return False


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
        return self._stop.isSet()

    def run(self):
        global zone_operator_sessions
        while True:
            if self.stopped():
                return
            logging.info(f"Checking {len(zone_operator_sessions)} operator sessions")
            for zone in zone_operator_sessions.keys():
                if not is_zone_operator_session_valid(zone):
                    logging.info(f"Removed invalid zone operator session for zone {zone}")
            time.sleep(120)

cleanup_old_sessions_thread = OperatorSessionCleanupThread()
cleanup_old_sessions_thread.start()