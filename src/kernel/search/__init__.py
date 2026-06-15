import collections
import json
import logging
# create a Thread to periodically refresh the realm schemas
import threading
import time

from flask import Blueprint
from irods.session import iRODSSession

import signals
from cache import cache
from kernel.metadata_schema import SchemaManager, get_schema_manager
from lib.util import flatten_schema
from plugins.operator import \
    get_zone_operator_session  # @todo: use mango_lib proxy


class SchemaInfo:
    """utility class for using metadata schemas in the search module"""

    def __init__(self, realm: str, schema_name: str, schema_dict: dict, schema_manager):
        self._realm = realm
        self._name = schema_name
        self._title = schema_dict.get("title", None)
        # self._schema = transform_schema(self.name, schema_manager)
        self.schema = self.transform_schema(schema_manager)

    @property
    def attributes(self):
        return list(self.schema.keys())

    @property
    def title(self):
        return (self.key, self._title)

    @property
    def key(self):
        return f"{self._realm}_{self._name}"

    def transform_schema(self, schema_manager):
        schema_dict = json.loads(schema_manager.load_schema(self._name))

        flattened_schema = flatten_schema(
            schema_dict,
            level=0,
            prefix=f"mgs.{self._name}",
            result_dict={},
            add_enum=True,
        )
        transformed_schema = {}
        for item in flattened_schema.items():
            transformed_schema |= SchemaInfo.restructure_item(item, flattened_schema)

        return transformed_schema

    @staticmethod
    def restructure_item(item, flattened_schema):
        key, value = item
        restructured_item = {
            key: {
                "type": ("label" if value["type"] == "object" else value["type"]),
                "enum": (value.get("enum", None)),
                "level": value["level"],
                "parent": (
                    None if value["level"] == 0 else ".".join(str(key).split(".")[:-1])
                ),
                "title": (
                    SchemaInfo.create_nested_label(key, flattened_schema)
                    if value["type"] == "object"
                    else value["label"]
                ),  # actual title
                # label with hierarchy for display in select
            }
        }
        return restructured_item

    @staticmethod
    def create_nested_label(key, flattened_schema):
        parts = key.split(".")
        ids = parts[2:]
        label_list = [
            flattened_schema[".".join(parts[:2] + ids[: i + 1])][
                "label"
            ]  # add +1 here because range starts from 0
            for i in range(len(ids))
        ]
        # print(label_list)
        return " / ".join(label_list)


realm_schemas = collections.defaultdict(dict[str, dict[str, SchemaInfo]])
realm_schemas_last_update = collections.defaultdict(dict)

realm_schemas_queue = []
MAX_SCHEMA_UPDATE_RETRIES = 5  # maximum number of retries for a failed update


@cache.memoize(1200)
def get_zone_realm_schemas(zone: str, realm: str):
    """Adapted from the original get_zone_realm_schemas originally in basic_search"""

    schema_manager: SchemaManager = get_schema_manager(zone=zone, realm=realm)

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
    # logging.info(
    #     f"Updating realm schemas for user {username} in zone {zone} upon login"
    # )
    user_session = get_zone_operator_session(zone, client_user=username)
    user_realms = user_session.collections.get(f"/{zone}/home").subcollections
    realm_names_to_check = [
        realm.name for realm in user_realms if realm.name != "public"
    ]
    # Add with initial retry_count = 0
    realm_schemas_queue.append((zone, realm_names_to_check, 0))
    # logging.info(f"Added to schema realm queue for {zone}: {realm_names_to_check}")


# wire it into the user session creation signal
signals.session_pool_user_session_created.connect(
    queue_realm_schemas_updates_upon_login
)


def realm_schemas_updater():
    """
    Continuously processes the realm_schemas_queue to update realm schemas for specified zones and realms,
    handling errors and retrying updates as needed.
    """
    logging.info("Realm schemas updater thread started")
    while True:
        try:
            if realm_schemas_queue:
                zone, realm_names_to_check, retry_count = realm_schemas_queue.pop(0)
                for realm_name in realm_names_to_check:
                    start = time.time()
                    # logging.info(
                    #     f"Updating realm schemas for realm {realm_name} in zone {zone}"
                    # )
                    try:
                        update_realm_schemas(
                            get_zone_operator_session(zone), realm_name, refresh=True
                        )
                        # logging.info(
                        #     f"Finished updating realm schemas for realm {realm_name} in zone {zone} in {time.time() - start:.2f} seconds"
                        # )
                    except Exception as e:
                        logging.error(
                            f"Failed to update realm schemas for realm {realm_name} in zone {zone}: {e}",
                            exc_info=True,
                        )
                        # Re-queue for retry if transient error, up to MAX_SCHEMA_UPDATE_RETRIES
                        if retry_count + 1 < MAX_SCHEMA_UPDATE_RETRIES:
                            logging.info(
                                f"Retrying update for realm {realm_name} in zone {zone} (attempt {retry_count + 2}/{MAX_SCHEMA_UPDATE_RETRIES})"
                            )
                            realm_schemas_queue.append(
                                (zone, [realm_name], retry_count + 1)
                            )
                        else:
                            logging.error(
                                f"Giving up updating realm schemas for realm {realm_name} in zone {zone} after {MAX_SCHEMA_UPDATE_RETRIES} attempts"
                            )

        except Exception as e:
            logging.error(
                f"Unexpected error in realm_schemas_updater loop: {e}", exc_info=True
            )

        min_sleep = 0.1  # minimum sleep time
        sleep_time = (
            max(1.0 / (3 * len(realm_schemas_queue)), min_sleep)
            if realm_schemas_queue
            else 1.0
        )
        time.sleep(sleep_time)


# Create the thread and start it
# @todo, use a context manager? see mango ingest
threading.Thread(target=realm_schemas_updater, daemon=True).start()
