# from irods.collection import iRODSCollection
from irods.session import iRODSSession
from app import app
import json
import re
import logging
import semver

# import time

from pathlib import Path
import importlib

MANGO_STORAGE_BASE_PATH = Path("storage")

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

    def get_user_permissions_for_realm(self, irods_session: iRODSSession):
        # anyone can do anything
        return self.allow_all

    def get_user_permissions_for_schema(
        self, irods_session: iRODSSession, schema: str | None = None
    ):
        return self.inherit_permissions

    def get_defined_schema_permissions(self, realm: None):
        return self.schema_permissions

class FileSystemSchemaManager:
    def __init__(
        self,
        zone: str,
        realm: str,
        permission_manager_class=BaseSchemaPermissionsManager,
    ):
        self._storage_schemas_path = (
            MANGO_STORAGE_BASE_PATH / zone / "mango" / "realms" / realm / "schemas"
        )
        if not self._storage_schemas_path.exists():
            # mkdir -p equivalent
            self._storage_schemas_path.mkdir(parents=True, exist_ok=True)
        # load schemas if any exist yet
        self.zone = zone
        self.realm = realm
        self.permission_manager: BaseSchemaPermissionsManager = (
            permission_manager_class(zone=zone, realm=realm)
        )

        self._schemas = self.list_schemas(filters=[])
        self._schemas_dir_mtime = self._storage_schemas_path.stat().st_mtime

        # print(self)

    def increment_version(self, version_string: str, part="major"):
        if re.match(r"\d\.\d\.\d", version_string):
            (major, minor, bugfix) = version_string.split(".")
            if part == "major":
                major = str(int(major) + 1)
            if part == "minor":
                minor = str(int(minor) + 1)
            if part == "bugfix":
                bugfix = str(int(bugfix) + 1)
            # locals()[part] = int(locals()[part]) + 1 this does not work :(((((
            new_version = ".".join((major, minor, bugfix))
            logging.info(
                f"incrementing for {version_string} and part {part} to {locals()[part]}"
            )
            return new_version

        return ""

    def _get_realm_schemas_path(self) -> Path:
        return self._storage_schemas_path

    def _get_schema_path(self, schema_name: str) -> Path:
        schema_path = self._get_realm_schemas_path() / schema_name
        if not schema_path.exists():
            schema_path.mkdir(parents=True, exist_ok=True)
        return schema_path

    def get_schema_info(self, schema_name: str) -> dict:
        schema_dir = self._get_schema_path(schema_name)
        if (
            hasattr(self, "_schemas")
            and (schema_name in self._schemas)
            and (self._schemas[schema_name]["timestamp"] == schema_dir.stat().st_mtime)
        ):
            return self._schemas[schema_name]

        all_schema_files = list(schema_dir.glob("*.json"))
        # pprint.pprint(all_schema_files)
        published_files = list(schema_dir.glob("*published.json"))
        draft_files = list(schema_dir.glob("*draft.json"))
        total_count = len(all_schema_files)
        published_count = len(published_files)
        draft_count = len(draft_files)
        versions_sorted = sorted(
            [
                re.search(
                    r"-v(\d\.\d\.\d)(\.json|-published\.json|-draft\.json)$",
                    schema_file.name,
                ).group(1)
                for schema_file in all_schema_files
            ]
        )

        # Obtain the schema title from one of the files
        title = ""
        if total_count > 0:
            with all_schema_files[0].open() as first_schema_file:
                schema_file_content = json.load(first_schema_file)
                title = (
                    schema_file_content["title"]
                    if "title" in schema_file_content
                    else "UNKNOWN"
                )

        return {
            "total_count": total_count,
            "published_count": published_count,
            "published": True if published_count > 0 else False,
            "draft_count": draft_count,
            "draft": True if draft_count > 0 else False,
            "archived": True
            if all([draft_count == 0, published_count == 0, total_count > 0])
            else False,
            "published_name": sorted(published_files)[-1].name
            if published_count >= 1
            else "",
            "draft_name": sorted(draft_files)[-1].name if draft_count >= 1 else "",
            "timestamp": schema_dir.stat().st_mtime,
            "versions_sorted": versions_sorted,
            "latest_version": versions_sorted[-1] if total_count > 0 else "",
            "realm": self.realm,
            "title": title,
        }

    def list_schemas(self, filters=["published", "draft"]) -> dict:
        """
        filters: possible values: "published", meaning they contain a published version. This is needed for using schemas to add / edit metadata
        """

        realm_schemas_path = self._get_realm_schemas_path()
        schemas = []
        if hasattr(self, "_schemas_dir_mtime") and (
            realm_schemas_path.stat().st_mtime == self._schemas_dir_mtime
        ):
            schemas = self._schemas.keys()
        else:
            schemas = [
                schema_path.name
                for schema_path in realm_schemas_path.glob("*")
                if schema_path.is_dir()
            ]

        schemas_dict = {schema: self.get_schema_info(schema) for schema in schemas}

        if not filters:
            return schemas_dict
        if filters:
            return {
                schema: schema_info
                for schema, schema_info in schemas_dict.items()
                if any([schema_info[filter] for filter in filters])
            }

    def load_schema(
        self, schema_name: str, status="published", version=""
    ) -> dict | bool:
        schema_paths = []
        if status in ["published", "draft"] and not version:
            schema_paths = list(
                self._get_schema_path(schema_name).glob(f"{schema_name}*{status}.json")
            )
        if version:
            schema_paths = list(
                self._get_schema_path(schema_name).glob(
                    f"*{schema_name}*v{version}*.json"
                )
            )
        if len(schema_paths) >= 1:
            return sorted(schema_paths)[-1].read_text()

        return False

    def store_schema(
        self,
        raw_schema: dict,
        schema_name: str,
        current_version="auto-major",
        with_status="draft",
        title="MISSING TITLE",
        username="unknown",
        parent="",
    ):
        current_schema_info = self.get_schema_info(schema_name)
        # Check validity of save request
        validity = {"version": {"valid": True}, "title": {"valid": True}}
        if (
            current_schema_info["latest_version"]
            and semver.compare(current_version, current_schema_info["latest_version"])
            < 0
        ):
            if not any(
                (current_schema_info["draft"], current_schema_info["published"])
            ):
                # there are only archived versions
                validity["version"] = {
                    "valid": False,
                    "message": f"Only archived versions for schema {schema_name} in zone {self.zone} and realm {self.realm}",
                }
                logging.warn(
                    f"Only archived versions for schema {schema_name} in zone {self.zone} and realm {self.realm}. Requested version ({current_version}) is smaller than latest recorded version ({current_schema_info['latest_version']})"
                )
            else:
                validity["version"] = {
                    "valid": False,
                    "message": f"Requested version ({current_version}) is smaller than latest recorded version ({current_schema_info['latest_version']})",
                }
                logging.warn(
                    f"Problem: requested schema version ({current_version}) to store smaller than highest so far ({current_schema_info['latest_version']}) for {schema_name} in zone {self.zone} and realm {self.realm}"
                )

            current_version = self.increment_version(
                current_schema_info["latest_version"], part="major"
            )
        if current_schema_info["title"] and current_schema_info["title"] != title:
            title = current_schema_info["title"]
            validity["title"] = {
                "valid": False,
                "message": f"requested schema title is different from existing for schema {schema_name} in zone {self.zone} and realm {self.realm}",
            }
            logging.warn(
                f"Refused to change title for schema {schema_name} in zone {self.zone} and realm {self.realm}"
            )

        json_contents = {
            "schema_name": schema_name,
            "version": current_version,
            "status": with_status,
            "properties": raw_schema,
            "edited_by": username,
            "realm": self.realm,
            "title": title,
            "parent": parent,
        }

        if with_status == "draft":
            if draft_file_name := current_schema_info["draft_name"]:
                # file already exists, we will keep the version number if it corresponds to the latest one
                if current_schema_info["latest_version"] and re.search(
                    r"{current_schema_info['latest_version']}".replace(".", "\."),
                    draft_file_name,
                ):
                    json_contents["version"] = current_schema_info["latest_version"]
                    draft_file_name.write_text(json.dumps(json_contents))
                else:
                    current_version = (
                        current_schema_info["latest_version"]
                        if current_schema_info["latest_version"]
                        else "v1.0.0"
                    )
                    json_contents["version"] = current_version
                    draft_file_name = (
                        self._get_schema_path(schema_name)
                        / f"{schema_name}-v{current_version}-draft.json"
                    )
                    draft_file_name.write_text(json.dumps(json_contents))
            else:
                if current_version.startswith("auto"):
                    auto_part = current_version.split("-")[1]  # major, minor, bugfix
                    current_version = self.increment_version(
                        current_schema_info["latest_version"]
                        if current_schema_info["latest_version"]
                        else "1.0.0",
                        auto_part,
                    )
                json_contents["version"] = current_version

                draft_file = (
                    self._get_schema_path(schema_name)
                    / f"{schema_name}-v{current_version}-draft.json"
                )

                draft_file.write_text(json.dumps(json_contents))

        if with_status == "published":
            # First see what the origin could be: for example is there a draft version or not
            # if so we need to re-use the version from that draft version
            # if there is no draft version, check if there is an (older) published version en rename it by
            # removing the "published" attribute in the filename and calculate a new version
            if draft_file_name := current_schema_info["draft_name"]:
                draft_file: Path = self._get_schema_path(schema_name) / draft_file_name
                draft_file.unlink()
            if current_schema_info["published_name"]:
                self.archive_published_schema(schema_name)

            new_published_file = (
                self._get_schema_path(schema_name)
                / f"{schema_name}-v{current_version}-published.json"
            )

            new_published_file.write_text(json.dumps(json_contents))

        return validity

        # return super().store_schema(**kwargs)

    def archive_published_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if published_file_name := current_schema_info["published_name"]:
            published_file: Path = (
                self._get_schema_path(schema_name) / published_file_name
            )
            # change the status to archived
            schema_dict = json.loads(published_file.read_text())
            schema_dict["status"] = "archived"
            published_file.write_text(json.dumps(schema_dict))
            published_file.rename(
                self._get_schema_path(schema_name)
                / published_file_name.replace("-published.json", ".json")
            )
            return True
        else:
            return False

    def check_and_sanitize_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if current_schema_info["total_count"] == 0:
            current_schema_path = self._get_realm_schemas_path() / schema_name
            current_schema_path.rmdir()
            logging.warn(
                f"Removed schema directory {current_schema_path} from file system because there are no more files left"
            )
        # TODO: check for multiple drafts, published versions that may be there because of non robust handling

    def delete_draft_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if draft_file_name := current_schema_info["draft_name"]:
            draft_file: Path = self._get_schema_path(schema_name) / draft_file_name
            draft_file.unlink()
            # do a sanitize check, maybe the directory can be deleted
            self.check_and_sanitize_schema(schema_name)

            return True
        else:
            return False

    def get_user_permissions_realm(self, irods_session):
        return self.permission_manager.get_user_permissions_realm(
            irods_session=irods_session
        )

    def get_user_permissions_schema(self, irods_session, schema):
        return self.permission_manager.get_user_permissions_schema(
            irods_session=irods_session, schema=schema
        )


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

schema_managers = {}

logging.info(
    f"Schema permissions manager from config: {schema_permissions_manager_class.__name__}"
)


def get_schema_manager(zone: str, realm: str) -> FileSystemSchemaManager:
    global schema_managers
    if zone_realm_key := f"{zone}-{realm}" not in schema_managers:
        schema_managers[zone_realm_key] = FileSystemSchemaManager(
            zone, realm, schema_permissions_manager_class
        )

    return schema_managers[zone_realm_key]
