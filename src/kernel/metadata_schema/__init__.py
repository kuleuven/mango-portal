# from irods.collection import iRODSCollection
from irods.session import iRODSSession
from app import app
import logging

import importlib


SCHEMA_CORE_PERMISSIONS = {
    "read_schema": 1 << 0,
    "read_archived": 1 << 1,
    "read_draft": 1 << 2,
    "edit_draft": 1 << 3,
    "create_draft": 1 << 4,
    "delete_draft": 1 << 5,
    "publish_draft": 1 << 6,
    "create_new_schema_draft": 1 << 7,
    "archive_schema": 1 << 8,  # basically disable the schema
}


def combine_permissions(_keys: list[str]):
    return sum([SCHEMA_CORE_PERMISSIONS[scp] for scp in _keys])


SCHEMA_PERMISSIONS = SCHEMA_CORE_PERMISSIONS | {
    "write_schema": combine_permissions(
        ["read_schema", "read_draft", "edit_draft", "create_draft", "delete_draft"]
    ),
    "read": combine_permissions(["read_schema", "read_archived"]),
    "create_new_schema": combine_permissions(
        [
            "create_new_schema_draft",
            "read_schema",
            "read_archived",
            "read_draft",
            "edit_draft",
            "create_draft",
            "delete_draft",
        ]
    ),
}


class BaseSchemaPermissionsManager:
    def __init__(self, zone: str, realm: str = ""):
        self.zone = zone
        self.realm = realm
        self.schema_permissions = SCHEMA_PERMISSIONS
        self.allow_all_bool = {
            permission: True for permission in SCHEMA_CORE_PERMISSIONS.keys()
        }
        self.allow_all = sum(SCHEMA_CORE_PERMISSIONS.values())
        self.deny_all = 0
        self.inherit_permissions = None

    def get_user_permissions_realm(self, irods_session: iRODSSession):
        # anyone can do anything
        return self.allow_all

    def get_user_permissions_schema(
        self, irods_session: iRODSSession, schema: str | None = None
    ):
        return self.inherit_permissions

    def get_defined_schema_permissions(self, realm: None):
        return self.schema_permissions


class SchemaManager:
    pass


# register the schema permissions manager
schema_permissions_manager_config = app.config.get(
    "MANGO_SCHEMA_PERMISSIONS_MANAGER_CLASS",
    {"module": "kernel.metadata_schema", "class": "BaseSchemaPermissionsManager"},
)
schema_permissions_manager_module = importlib.import_module(
    schema_permissions_manager_config["module"], package="app"
)
schema_permissions_manager_class = getattr(
    schema_permissions_manager_module, schema_permissions_manager_config["class"]
)
schema_manager_config = app.config.get(
    "MANGO_SCHEMA_MANAGER_CLASS",
    {
        "module": "kernel.metadata_schema.schema_handler",
        "class": "FileSystemSchemaManager",
    },
)
schema_manager_module = importlib.import_module(
    schema_manager_config["module"], package="app"
)
schema_manager_class = getattr(schema_manager_module, schema_manager_config["class"])

schema_managers = {}

logging.info(
    f"Schema permissions manager from config: {schema_permissions_manager_class.__name__}"
)


def get_schema_manager(zone: str, realm: str) -> SchemaManager:
    global schema_managers

    if zone_realm_key := f"{zone}-{realm}" not in schema_managers:
        schema_managers[zone_realm_key] = schema_manager_class(
            zone, realm, schema_permissions_manager_class
        )

    return schema_managers[zone_realm_key]
