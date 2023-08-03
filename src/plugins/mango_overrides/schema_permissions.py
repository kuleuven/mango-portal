# Requires: user_tantra plugin
import plugins.user_tantra

from kernel.metadata_schema import BaseSchemaPermissionsManager
from irods.session import iRODSSession

SCHEMA_MANAGER_GROUP_SUFFIX = "schema_manager"

class GroupBasedSchemaPermissions(BaseSchemaPermissionsManager):
    def __init__(self, zone: str, realm: str):
        super().__init__(zone, realm)
        self.group_schema_manager = f"{realm}_{SCHEMA_MANAGER_GROUP_SUFFIX}"

    def get_user_permissions(self, irods_session: iRODSSession, schema: str | None = None):
        if self.realm == irods_session.username:
            return self.allow_all
        if self.realm == "public":
            if "mango_portal_admin" in irods_session.roles:
                return self.allow_all
            else:
                return self.schema_permissions['read']
        if self.group_schema_manager in irods_session.my_group_names:
            return self.allow_all
        if self.realm in irods_session.my_group_names:
            return self.schema_permissions['read']
        
        return self.deny_all
    
