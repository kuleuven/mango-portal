import os
import json
from opensearchpy import OpenSearch, helpers
from irods.session import iRODSSession
from irods.collection import iRODSCollection
from irods.data_object import iRODSDataObject
from slugify import slugify
import pprint
import os
import ssl
import requests
import irods_zones_config
from threading import Lock, Thread, Event
import datetime, time, logging



API_URL = os.environ.get('API_URL', 'https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be')
API_TOKEN = os.environ.get('API_TOKEN', '')

pprint.pprint(irods_zones_config.irods_zones.keys())

MANGO_OPEN_SEARCH_HOST = os.environ.get('MANGO_OPEN_SEARCH_HOST', 'localhost')
MANGO_OPEN_SEARCH_HOST_QUERY = os.environ.get('MANGO_OPEN_SEARCH_HOST_QUERY', MANGO_OPEN_SEARCH_HOST)
MANGO_OPEN_SEARCH_HOST_INGEST = os.environ.get('MANGO_OPEN_SEARCH_HOST_INGEST', MANGO_OPEN_SEARCH_HOST_QUERY)

MANGO_OPEN_SEARCH_PORT = os.environ.get('MANGO_OPEN_SEARCH_PORT', 9200)
MANGO_OPEN_SEARCH_USER = os.environ.get('MANGO_OPEN_SEARCH_USER', 'admin')
MANGO_OPEN_SEARCH_PASSWORD = os.environ.get('MANGO_OPEN_SEARCH_PASSWORD', 'admin')
MANGO_OPEN_SEARCH_INDEX_NAME = os.environ.get('MANGO_OPEN_SEARCH_INDEX_NAME', 'irods-global')

MANGO_OPEN_SEARCH_AUTH = (MANGO_OPEN_SEARCH_USER, MANGO_OPEN_SEARCH_PASSWORD) #('irods-vscp', 'NTU1Y2M1YjU4YWQ4NjA2ZTQ2ODRkY2Jh')
MANGO_INDEX_THREAD_SLEEP_TIME=5
MANGO_INDEX_THREAD_HEARTBEAT_TIME=300
# For now a single client
# @todo: create a pool (object) of clients to use by multiple threads
mango_open_search_client = OpenSearch(
    hosts = [{'host': MANGO_OPEN_SEARCH_HOST_QUERY, 'port': MANGO_OPEN_SEARCH_PORT}],
    http_compress = False, # enables gzip compression for request bodies
    http_auth = MANGO_OPEN_SEARCH_AUTH,
    # client_cert = client_cert_path,
    # client_key = client_key_path,
    use_ssl = True,
    verify_certs = False,
    ssl_assert_hostname = False,
    ssl_show_warn = False,
    #ca_certs = ca_certs_path
)

# create a dedicated open search index client for this node
mango_open_search_client_ingest = OpenSearch(
    hosts = [{'host': MANGO_OPEN_SEARCH_HOST_INGEST, 'port': MANGO_OPEN_SEARCH_PORT}],
    http_compress = False, # enables gzip compression for request bodies
    http_auth = MANGO_OPEN_SEARCH_AUTH,
    # client_cert = client_cert_path,
    # client_key = client_key_path,
    use_ssl = True,
    verify_certs = False,
    ssl_assert_hostname = False,
    ssl_show_warn = False,
    #ca_certs = ca_certs_path
)


def get_index_session_params_via_api(zone: str):
    if not API_URL or not API_TOKEN or not zone in irods_zones_config.irods_zones:
        return False
    jobid = irods_zones_config.irods_zones[zone]['jobid']
    #/irods/zones/{id}/admin_token
    header = {'Authorization': 'Bearer ' + API_TOKEN}
    response = requests.post(f'{API_URL}/v1/irods/zones/{jobid}/admin_token', headers=header)
    response.raise_for_status()
    return response.json()



index_queue = []

ALLOWED_JOB_TYPES = ['item', 'subtree']

def add_index_job(zone: str, job_type : str, item_path: str, item_type: str):
    """
    type can be 'item', 'subtree'
    """
    global index_queue
    index_queue.append({'zone': zone, 'job_type': job_type, 'item_path': item_path, 'item_type': item_type, 'time': datetime.datetime.now()})

zone_index_sessions = {}

def get_zone_index_session(zone: str):
    global zone_index_sessions
    if zone in zone_index_sessions and zone_index_sessions[zone].expiration > datetime.datetime.now():
        return zone_index_sessions[zone]
    # if expired but present, destroy the zone session
    if zone in zone_index_sessions and zone_index_sessions[zone].expiration < datetime.datetime.now():
        del(zone_index_sessions[zone])
    # use the API to get login parameters and create a session
    session_parameters = get_index_session_params_via_api(zone)
    logging.info(f"Requested ")
    try:
        irods_session = iRODSSession(**session_parameters['irods_environment'],
            password = session_parameters['token'])
        # set the expiration time (4h) a bit lower than the real one to compensate running time and register it on the session object
        from dateutil.parser import parse
        irods_session.expiration = parse(session_parameters['expiration'], ignoretz = True) - datetime.timedelta(minutes=20)
        zone_index_sessions[zone] = irods_session
        return zone_index_sessions[zone]
    except:
        logging.info(f"Failed getting indexing session for zone {zone}")
        return None

def get_open_search_client(type='query'):
    # to be changed to a pooled version when running multiple threads
    global mango_open_search_client
    global mango_open_search_client_ingest
    if type == 'ingest':
        return mango_open_search_client_ingest
    return mango_open_search_client

# simple caching strategy
path_ids = {}

def get_path_id(irods_session: iRODSSession, path: str):
    """
    Important for the path variable, we expect a leading forward slash starting with the zone name
    No checking done for performance
    """
    global path_ids
    if not path in path_ids:
        try:
            collection : iRODSCollection = irods_session.collections.get(path)
            path_ids[path] = collection.id
        except Exception:
            return False
    return path_ids[path]


def get_basic_index_doc_for_item(irods_session: iRODSSession, item : iRODSCollection | iRODSDataObject, **options):
    """
    """
    fields = {}
    mango_prefix = 'mg.'
    field_mappings = {}

    metadata = item.metadata.items()
    for avu in metadata:
        if avu.name.startswith(mango_prefix):
            fields[avu.name] = avu.value
            field_mappings[avu.name]=avu.name
        else:
            os_field_name = slugify(avu.name, separator="__")
            fields[os_field_name] = avu.value
            field_mappings[os_field_name]=avu.name
            if avu.units:
                fields[f"{slugify(avu.name, separator='__')}_units"] = avu.units
    fields['irods_zone_name'] = irods_session.zone
    fields['irods_item_type'] = item.__class__.__name__.lower()
    fields['irods_item_type_simple'] = 'c' if isinstance(item, iRODSCollection) else 'd'
    if isinstance(item, iRODSDataObject):
        fields['size'] = item.size
    # To be changed with PRC release >= 1.1.6
    acl_users = []
    _permissions = irods_session.permissions.get(
        item, report_raw_acls=True, acl_users=acl_users
    )
    acl_read_users = []
    acl_read_groups = []

    for acl_user in acl_users:
        if acl_user.type in ['rodsuser', 'rodsadmin']:
            acl_read_users += [acl_user.id]
        if acl_user.type in ['rodsgroup']:
            acl_read_groups += [acl_user.id]
    if acl_read_users:
        fields['acl_read_users'] = acl_read_users
    if acl_read_groups:
        fields['acl_read_groups'] = acl_read_groups
    fields['irods_path'] = item.path
    fields['irods_name'] = item.name
    fields['irods_created'] = item.create_time
    fields['irods_modified'] = item.modify_time
    fields['irods_owner_name'] = item.owner_name
    fields['irods_owner_zone'] = item.owner_zone
    fields['irods_id'] = item.id

    parent_collection_path = item.collection.path if isinstance(item, iRODSDataObject) else os.path.dirname(item.path)
    #print(f"Parent path: {parent_collection_path}")
    parent_collection_path_ids = []
    parent_collection_paths = []
    parent_collection_path_elements = parent_collection_path.lstrip('/').split('/')
    #print(f"{parent_collection_path_elements}")
    fields['irods_parent_path'] = parent_collection_path

    for path_element in reversed(parent_collection_path_elements.copy()):
        #print(f"Path element: {path_element}")
        if path_element and (id := get_path_id(irods_session, parent_collection_iteration_path := f"/{'/'.join(parent_collection_path_elements)}")):
            parent_collection_path_ids += [id]
            parent_collection_paths += [parent_collection_iteration_path]
            _ = parent_collection_path_elements.pop()
    fields['irods_parent_path_ids'] = parent_collection_path_ids
    fields['irods_parent_paths'] = parent_collection_paths

    fields['_id'] = f"{fields['irods_zone_name']}_{fields['irods_item_type_simple']}_{fields['irods_id']}"

    return fields

def aggregate_fields(fields : dict):
    match_text_partials = ['name', 'title', 'description', 'comment', 'summary']
    match_all = ''
    for field_name in fields:
        for partial in match_text_partials:
            if partial in field_name:
                match_all = ' '.join([match_all, fields[field_name]])
    fields['match_all'] = match_all
    return fields

def generate_docs_for_children(irods_session: iRODSSession, collection: iRODSCollection, action = 'index'):
    docs = []
    for sub_collection in collection.subcollections:
        fields = get_basic_index_doc_for_item(irods_session, sub_collection)
        aggregate_fields(fields)
        fields["_index"] =  MANGO_OPEN_SEARCH_INDEX_NAME
        fields["_op_type"] = action
        docs.append(fields)
    for data_object in collection.data_objects:
        try:
            fields = get_basic_index_doc_for_item(irods_session, data_object)
            aggregate_fields(fields)
            fields["_index"] =  MANGO_OPEN_SEARCH_INDEX_NAME
            fields["_op_type"] = 'index'
            docs.append(fields)
        except Exception:
            print(f"Failed getting doc fields for {data_object.name}")
            pass
    return docs

def index_item(irods_session: iRODSSession, item_type:str, item_path:str):
    # normalize item_path
    if not item_type in ['collection', 'data_object']:
        return None
    if not item_path.startswith('/'):
        item_path = f"/{item_path}"
    try:
        if item_type == 'collection':
            item = irods_session.collections.get(item_path)
        if item_type == 'data_object':
            item = irods_session.data_objects.get(item_path)

        fields = get_basic_index_doc_for_item(irods_session, item)
        id = fields.pop('_id')
        aggregate_fields(fields)
        response = get_open_search_client(type='ingest').index(MANGO_OPEN_SEARCH_INDEX_NAME, fields, id = id, refresh=True)
        return response

    except Exception:
        return None

def index_children(irods_session: iRODSSession, collection_path: str, schedule_sub_collections = True):
    #try:
    collection = irods_session.collections.get(collection_path)
    print(f"Got collection from {collection_path}, now bulk indexing")
    actions = generate_docs_for_children(irods_session, collection, action = 'index')
    #pprint.pprint(actions)
    response = helpers.bulk(get_open_search_client(type='ingest'), actions)

    if schedule_sub_collections:
        for sub_collection in collection.subcollections:
            add_index_job(zone = irods_session.zone, job_type='subtree', item_path=sub_collection.path, item_type='collection')

    return response



def execute_index_job(zone: str, job_type: str, item_type, item_path, time):
    if not job_type in ALLOWED_JOB_TYPES:
        return
    _ = time # not used, but present in the **parameter expansion calling this function

    irods_session_for_zone = get_zone_index_session(zone)
    if not irods_session_for_zone:
        logging.warn("Cannot index, no valid irods indexing session, aborting, but adding job again to the queue")
        add_index_job(zone = zone, job_type=job_type, item_type=item_type, item_path=item_path)
        return
    if job_type == 'item':
        result = index_item(irods_session_for_zone, item_type, item_path)
    if job_type == 'subtree' and item_type == 'collection':
        result = index_children(irods_session_for_zone, item_path, schedule_sub_collections=True)



#Indexing thread :)

class IndexingThread(Thread):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop = Event()
        self.daemon = True
        self.start_time=datetime.datetime.now()
        self.heartbeat_time = time.time()
        logging.info(f"Indexing thread created")
        self.status = 'active'

    def stop(self):
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

    def set_status(self, status='sleep'):
        self.status = status


    def run(self):

        global index_queue
        while True:
            # stop doing anything if we are stopped (externally)
            if self.stopped():
                return

            current_time = datetime.datetime.now()

            if len(index_queue) > 0 and  self.status == 'active':
                logging.info(f"Indexing {index_queue[0]}")
                execute_index_job(**index_queue.pop(0))

            if self.status == 'sleep':
                pass
            if self.status == 'flush':
                index_queue = []

            if self.status == 'flush_sleep':
                index_queue = []
                self.set_status('sleep')

            if self.status == 'flush_active':
                index_queue = []
                self.set_status('active')


            # irods_user_sessions = {session_id: user_session for session_id, user_session in irods_user_sessions.items()
            #     if (current_time - user_session.last_accessed).total_seconds() < SESSION_TTL or user_session.lock.locked()}

            # for session_id, user_session in irods_user_sessions.items():
            #     session_age = (current_time - user_session.last_accessed).total_seconds()
            #     logging.info(f"Inspecting for {session_id}: age={session_age}, lock state={user_session.lock.locked()}")
            #     if session_age > SESSION_TTL and not user_session.lock.locked():
            #         del irods_user_sessions[session_id]
            #         logging.info(f"Removed {session_id}")
            time.sleep(MANGO_INDEX_THREAD_SLEEP_TIME)
            # emit a heartbeat logging at most every 300 seconds
            if time.time() - self.heartbeat_time > MANGO_INDEX_THREAD_HEARTBEAT_TIME:
                # reset the heartbeat reference time point
                self.heartbeat_time = time.time()
                logging.info(f"Indexing thread heartbeat")


# debug start indexing hard coded path
#add_index_job(zone = 'kuleuven_tier1_pilot', job_type='subtree', item_path='/kuleuven_tier1_pilot/home/vsc33436', item_type='collection')

indexing_thread = IndexingThread()
indexing_thread.start()


    # except Exception:
    #     print(f"Failed index_children")
    #     return None
