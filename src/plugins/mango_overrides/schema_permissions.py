# Requires: user_tantra plugin
import plugins.user_tantra

from kernel.metadata_schema import BaseSchemaPermissionsManager
from irods.session import iRODSSession

SCHEMA_MANAGER_GROUP_SUFFIX = "schema_manager"


class GroupBasedSchemaPermissions(BaseSchemaPermissionsManager):
    def __init__(self, zone: str, realm: str):
        super().__init__(zone, realm)
        self.group_schema_manager = f"{realm}_{SCHEMA_MANAGER_GROUP_SUFFIX}"
        self.realm_manager = f"{realm}_manager"

    def get_user_permissions_realm(self, irods_session: iRODSSession):
        # check if the realm is the user personal space and grant full access
        if self.realm == irods_session.username:
            return self.allow_all
        # the public realm holds all common zone schemas
        # mango portal admins are the sole responsibles for managing them
        # other users get read access (published and archived only)
        if self.realm == "public":
            if "mango_portal_admin" in irods_session.roles:
                return self.allow_all
            else:
                return self.schema_permissions["read"]
        # realm schema managers "{realm}_schema_manager" have full rights
        # realm members only read rights
        if any(
            group in irods_session.my_group_names
            for group in (self.group_schema_manager, self.realm_manager)
        ):
            return self.allow_all
        if self.realm in irods_session.my_group_names:
            return self.schema_permissions["read"]

        # if no matches, nothing allowed
        return self.deny_all

    def get_user_permissions_schema(self, irods_session: iRODSSession, schema):
        return self.inherit_permissions
