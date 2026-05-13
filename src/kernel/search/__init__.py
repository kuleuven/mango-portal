import logging
# create a Thread to periodically refresh the realm schemas
import threading
import time

from irods.session import iRODSSession

import signals
from cache import cache
from kernel.metadata_schema import SchemaManager, get_schema_manager
from kernel.search.basic_search import \
    SchemaInfo  # to move here or in the metadata schema module, no other uses detected so far
from plugins.operator import \
    get_zone_operator_session  # @todo: use mango_lib proxy

from .basic_search import realm_schemas, realm_schemas_last_update

realm_schemas_queue = []


@cache.memoize(1200)
def get_zone_realm_schemas(zone: str, realm: str):
    """Adapted from the original get_zone_realm_schemas originally in basic_search"""

    schema_manager: SchemaManager = get_schema_manager(
        zone=zone, realm=realm
    )

    my_schemas = schema_manager.list_schemas(
        filters=["published"]
    )  # TODO archived schemas should also be searchable ...

    # generator to instantiate SchemaInfo classes
    schema_generator = (
        SchemaInfo(realm, schema_name, schema_dict, schema_manager)
        for schema_name, schema_dict in my_schemas.items()
    )

    # store schemas as dict with key (realm_name) and SchemaInfo as value
    schemas_dict = {
        schema.key: schema for schema in schema_generator
    }  # transformed schemas dictionary to feed Advanced Search

    return schemas_dict


def update_realm_schemas(irods_session: iRODSSession, realm_name: str, refresh=False):
    global realm_schemas
    zone = irods_session.zone

    if realm_name and (
        realm_name not in realm_schemas[zone]
        or (
            refresh
            and time.time() - realm_schemas_last_update[zone][realm_name] > 3600 * 8
        )
    ):
        realm_schemas[zone][realm_name] = {}
        realm_schemas_last_update[zone][realm_name] = time.time()
        for k, v in get_zone_realm_schemas(zone, realm_name).items():
            realm_schemas[zone][realm_name][k] = v


def queue_realm_schemas_updates_upon_login(sender, **parameters):
    zone = parameters["zone"]
    username = parameters["username"]
    logging.info(
        f"Updating realm schemas for user {username} in zone {zone} upon login"
    )
    user_session = get_zone_operator_session(zone, client_user=username)
    user_realms = user_session.collections.get(f"/{zone}/home").subcollections
    realm_names_to_check = [
        realm.name for realm in user_realms if realm.name != "public"
    ]
    realm_schemas_queue.append((zone, realm_names_to_check))
    logging.info(f"Added to schema realm queue for {zone}: {realm_names_to_check}")


# wire it into the user session creation signal
signals.session_pool_user_session_created.connect(queue_realm_schemas_updates_upon_login)


# Now define a function and thread to process the queue and update the realm schemas
# @todo: make it robust so the thread does not die if an exception occurs, and add some logging to monitor the queue processing
def realm_schemas_updater():
    while True:
        if realm_schemas_queue:
            zone, realm_names_to_check = realm_schemas_queue.pop(0)
            for realm_name in realm_names_to_check:
                start = time.time()
                logging.info(
                    f"Updating realm schemas for realm {realm_name} in zone {zone}"
                )
                update_realm_schemas(
                    get_zone_operator_session(zone), realm_name, refresh=True
                )
                logging.info(
                    f"Finished updating realm schemas for realm {realm_name} in zone {zone} in {time.time() - start:.2f} seconds"
                )

        # check with a heuristic dynamic sleep time based on queue length :-)
        sleep_time = 1.0 / (3*len(realm_schemas_queue)) if realm_schemas_queue else 1.0
        time.sleep(sleep_time)  


# Create the thread and start it
# @todo, use a context manager? see mango ingest
threading.Thread(target=realm_schemas_updater, daemon=True).start()
