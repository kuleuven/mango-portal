from kernel.metadata_schema import BaseSchemaPermissionsManager, SchemaManager
from irods.session import iRODSSession
from irods.data_object import iRODSDataObject
from irods.collection import iRODSCollection
from irods.access import iRODSAccess
from pathlib import Path
import re
import json
import semver
from plugins.operator import get_zone_operator_session


class iRODSSchemaManager(SchemaManager):
    def __init__(
        self,
        zone: str,
        realm: str,
        permission_manager_class=BaseSchemaPermissionsManager,
    ):
        mango_collection = Path("/") / zone / "mango"
        rods_irods_session = get_zone_operator_session(zone, client_user="rods")
        if not rods_irods_session.collections.exists(str(mango_collection)):
            rods_irods_session.collections.create(str(mango_collection))
        rods_irods_session.acls.set(
            iRODSAccess("own", str(mango_collection), user_name="operator"),
            recursive=True,
        )
        irods_session = get_zone_operator_session(zone)
        self._storage_schemas_path = str(mango_collection / "schemas" / realm)

        if not irods_session.collections.exists(self._storage_schemas_path):
            _schema_manager_realm = irods_session.collections.create(
                self._storage_schemas_path, recurse=True
            )
            irods_session.acls.set(
                iRODSAccess("read", self._storage_schemas_path, user_name=realm),
                recursive=True,
            )
            irods_session.acls.set(iRODSAccess("inherit", self._storage_schemas_path))
        else:
            _schema_manager_realm = irods_session.collections.get(
                self._storage_schemas_path
            )

        # load schemas if any exist yet
        self.zone = zone
        self.realm = realm
        self.permission_manager: BaseSchemaPermissionsManager = (
            permission_manager_class(zone=zone, realm=realm)
        )

        self._schemas = self.list_schemas(
            filters=[]
        )  # check if there are existing schemas
        self._schemas_dir_mtime = (
            _schema_manager_realm.modify_time
        )  # set the 'last-updated' time

        # print(self)

    def increment_version(self, version_string: str, part="major"):
        if re.match(r"\d+\.\d+\.\d+", version_string):
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

    @property
    def irods_session(self) -> iRODSSession:
        return get_zone_operator_session(self.zone)

    @property
    def realm_schemas_path(self) -> iRODSCollection:
        irods_session = self.irods_session
        return irods_session.collections.get(self._storage_schemas_path)

    def _get_schema_path(self, schema_name: str) -> iRODSCollection:
        irods_session = self.irods_session
        schema_path = Path(self._storage_schemas_path) / schema_name
        return irods_session.collections.create(str(schema_path), recurse=True)

    def _get_schema_version_object(
        self, schema_name: str, file_name: str
    ) -> iRODSDataObject:
        irods_session = self.irods_session
        schema_version_path = str(
            Path(self._get_schema_path(schema_name).path) / file_name
        )
        if not irods_session.data_objects.exists(schema_version_path):
            return irods_session.data_objects.create(schema_version_path)
        return irods_session.data_objects.get(schema_version_path)

    def get_schema_info(self, schema_name: str) -> dict:
        schema_coll = self._get_schema_path(schema_name)
        if (
            hasattr(self, "_schemas")
            and (schema_name in self._schemas)
            and (
                self._schemas[schema_name]["timestamp"]
                == schema_coll.modify_time.timestamp()
            )
        ):
            return self._schemas[schema_name]

        all_schema_files = [
            obj for obj in schema_coll.data_objects if obj.name.endswith(".json")
        ]
        # pprint.pprint(all_schema_files)
        published_files = [
            obj.name for obj in all_schema_files if obj.name.endswith("published.json")
        ]
        draft_files = [
            obj.name for obj in all_schema_files if obj.name.endswith("draft.json")
        ]
        total_count = len(all_schema_files)
        published_count = len(published_files)
        draft_count = len(draft_files)
        versions_sorted = sorted(
            [
                re.search(
                    r"-v(\d+\.\d+\.\d+)(\.json|-published\.json|-draft\.json)$",
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
            "archived": (
                True
                if all([draft_count == 0, published_count == 0, total_count > 0])
                else False
            ),
            "published_name": (
                sorted(published_files)[-1] if published_count >= 1 else ""
            ),
            "draft_name": sorted(draft_files)[-1] if draft_count >= 1 else "",
            "timestamp": schema_coll.modify_time.timestamp(),
            "versions_sorted": versions_sorted,
            "latest_version": versions_sorted[-1] if total_count > 0 else "",
            "realm": self.realm,
            "title": title,
        }

    def list_schemas(self, filters=["published", "draft"]) -> dict:
        """
        filters: possible values: "published", meaning they contain a published version.
        This is needed for using schemas to add / edit metadata
        """

        realm_schemas_collection = self.realm_schemas_path
        schemas = []
        if hasattr(self, "_schemas_dir_mtime") and (
            realm_schemas_collection.modify_time == self._schemas_dir_mtime
        ):
            schemas = self._schemas.keys()
        else:
            schemas = [
                schema_path.name
                for schema_path in realm_schemas_collection.subcollections
            ]

        schemas_dict = {schema: self.get_schema_info(schema) for schema in schemas}
        print(schemas_dict)

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
            schema_paths = [
                obj
                for obj in self._get_schema_path(schema_name).data_objects
                if obj.name.endswith("json")
            ]
        if version:
            schema_paths = [
                obj
                for obj in self._get_schema_path(schema_name).data_objects
                if re.search(f".*{version}.*json", obj.name)
            ]
        if len(schema_paths) >= 1:
            schema_object = sorted(schema_paths, key=lambda x: x.name)[-1]
        else:
            schema_object = schema_paths[0]
        if schema_object:
            with schema_object.open() as f:
                return json.load(f)  # or f.read().decode() if we want it as a string

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
        ):  # current version is earlier than latest version
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
                    draft_object = self._get_schema_version_object(
                        schema_name, draft_file_name
                    )
                else:
                    current_version = (
                        current_schema_info["latest_version"]
                        if current_schema_info["latest_version"]
                        else "v1.0.0"
                    )
                    json_contents["version"] = current_version
                    draft_object = self._get_schema_version_object(
                        schema_name, f"{schema_name}-v{current_version}-draft.json"
                    )
            else:
                if current_version.startswith("auto"):
                    auto_part = current_version.split("-")[1]  # major, minor, bugfix
                    current_version = self.increment_version(
                        (
                            current_schema_info["latest_version"]
                            if current_schema_info["latest_version"]
                            else "1.0.0"
                        ),
                        auto_part,
                    )
                json_contents["version"] = current_version

                draft_object = self._get_schema_version_object(
                    schema_name, f"{schema_name}-v{current_version}-draft.json"
                )

            with draft_object.open("w") as f:
                f.write(json.dumps(json_contents).encode())

        if with_status == "published":
            # First see what the origin could be: for example is there a draft version or not
            # if so we need to re-use the version from that draft version
            # if there is no draft version, check if there is an (older) published version en rename it by
            # removing the "published" attribute in the filename and calculate a new version
            if draft_file_name := current_schema_info["draft_name"]:
                draft_file: iRODSDataObject = self._get_schema_version_object(
                    schema_name, draft_file_name
                )
                draft_file.unlink()
            if current_schema_info["published_name"]:
                self.archive_published_schema(schema_name)

            new_published_file = self._get_schema_version_object(
                schema_name, f"{schema_name}-v{current_version}-published.json"
            )

            with new_published_file.open("w") as f:
                f.write(json.dumps(json_contents).encode())

        return validity

        # return super().store_schema(**kwargs)

    def archive_published_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if published_file_name := current_schema_info["published_name"]:
            published_file: iRODSDataObject = self._get_schema_version_object(
                schema_name, published_file_name
            )
            # change the status to archived
            with published_file.open() as f:
                schema_dict = json.load(f)
            schema_dict["status"] = "archived"
            with published_file.open(
                "w"
            ) as f:  # it doesn't work to read and write with w+
                f.write(json.dumps(schema_dict).encode())
            self.irods_session.data_objects.move(
                published_file.path,
                published_file.path.replace("-published.json", ".json"),
            )
            return True
        return False

    def check_and_sanitize_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if current_schema_info["total_count"] == 0:
            current_schema_path = self._get_schema_path()
            current_schema_path.remove()
            logging.warn(
                f"Removed schema directory {current_schema_path.path} from file system because there are no more files left"
            )
        # TODO: check for multiple drafts, published versions that may be there because of non robust handling

    def delete_draft_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if draft_file_name := current_schema_info["draft_name"]:
            draft_file: iRODSDataObject = self._get_schema_version_object(
                schema_name, draft_file_name
            )
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
