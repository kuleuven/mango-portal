# from irods.collection import iRODSCollection
# from irods.session import iRODSSession
import json
import re
import logging

# import time

from pathlib import Path, PurePath


class SchemaManager(object):
    def __init__(self, zone: str, realm: str):
        pass

    def load_schema(self, **kwargs) -> dict:
        pass

    def list_schemas(self, **kwargs) -> dict:
        pass

    def store_schema(self, **kwargs):
        pass

    def delete_schema(self, **kwargs):
        pass


######## File system based schema management, using realms (projects, public, ....) to group schemas
### See doc folder in root of this repository


MANGO_STORAGE_BASE_PATH = Path("storage")


class FileSystemSchemaManager:
    def __init__(self, zone: str, realm: str):
        self._storage_schemas_path = (
            MANGO_STORAGE_BASE_PATH / zone / "mango" / "realms" / realm / "schemas"
        )
        if not self._storage_schemas_path.exists():
            # mkdir -p equivalent
            self._storage_schemas_path.mkdir(parents=True, exist_ok=True)
        # load schemas if any exist yet
        self._schemas = self.list_schemas()
        self._schemas_dir_mtime = self._storage_schemas_path.stat().st_mtime
        self.zone = zone
        self.realm = realm
        print(self)

    def increment_version(self, version_string: str, part="major"):
        if re.match(r"\d\.\d\.\d", version_string):
            (major, minor, bugfix) = version_string.split(".")
            locals()[part] = str(int(locals()[part]) + 1)
            return ".".join((major, minor, bugfix))

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
        if schema_name in self._schemas and (
            self._schemas[schema_name]["timestamp"] == schema_dir.stat().st_mtime
        ):
            return self._schemas[schema_name]

        all_schema_files = schema_dir.glob("*.json")
        published_files = schema_dir.glob("*published.json")
        draft_files = schema_dir.glob("*draft.json")
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
                title = schema_file_content["title"]

        self._schemas[schema_name] = {
            "total_count": total_count,
            "published_count": published_count,
            "draft_count": draft_count,
            "published_name": sorted(published_files)[-1].name
            if published_count >= 1
            else "",
            "draft_name": sorted(draft_files)[-1].name if draft_count >= 1 else "",
            "timestamp": schema_dir.stat().st_mtime,
            "versions_sorted": versions_sorted,
            "latest_version": versions_sorted[-1],
            "realm": self.realm,
            "title": title,
        }

        return self._schemas[schema_name]

    def list_schemas(self, filters=["published_count", "draft_count"]) -> dict:
        """
        filters: possible values: "published", meaning they contain a published version. This is needed for using schemas to add / edit metadata
        """

        realm_schemas_path = self._get_realm_schemas_path()
        if hasattr(self, "_schemas_dir_mtime") and (
            realm_schemas_path.stat().st_mtime == self._schemas_dir_mtime
        ):
            return self._schemas

        schemas = [
            schema_path.name
            for schema_path in realm_schemas_path.glob("*")
            if schema_path.is_dir()
        ]
        schemas_dict = self._schemas = {
            schema: self.get_schema_info(schema) for schema in schemas
        }

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
            schema_paths = self._get_schema_path(schema_name).glob(
                f"{schema_name}*{status}.json"
            )
        if version:
            schema_paths = self._get_schema_path(schema_name).glob(
                f"*{schema_name}*{version}*{status}.json"
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
        username="unknown"
    ):
        current_schema_info = self.get_schema_info(schema_name)
        if with_status == "draft":
            if draft_file_name := current_schema_info["draft_name"]:
                # file already exists, we will keep the version number if it corresponds to the latest one
                if current_schema_info["latest_version"] and re.search(
                    r"{current_schema_info['latest_version']}".replace(".", "\."),
                    draft_file_name,
                ):
                    draft_file_name.write_text(
                        json.dumps(
                            {
                                "schema_name": schema_name,
                                "version": current_schema_info["latest_version"],
                                "status": with_status,
                                "schema": raw_schema,
                                "edited_by": username,
                                "realm": self.realm,
                                "title": title,
                            }
                        )
                    )
                else:
                    current_version = (
                        current_schema_info["latest_version"]
                        if current_schema_info["latest_version"]
                        else "v1.0.0"
                    )
                    draft_file_name = (
                        self._get_schema_path(schema_name)
                        / f"{schema_name}-v{current_version}-draft.json"
                    )
                    draft_file_name.write_text(
                        json.dumps(
                            {
                                "schema_name": schema_name,
                                "version": current_version,
                                "status": with_status,
                                "schema": raw_schema,
                                "edited_by": username,
                                "realm": self.realm,
                                "title": title,
                            }
                        )
                    )
            else:
                if current_version.startswith("auto"):
                    auto_part = current_version.split("-")[1]  # major, minor, bugfix
                    current_version = self.increment_version(
                        current_schema_info["latest_version"]
                        if current_schema_info["latest_version"]
                        else "1.0.0",
                        auto_part,
                    )

                draft_file = (
                    self._get_schema_path(schema_name)
                    / f"{schema_name}-v{current_version}-draft.json"
                )

                draft_file.write_text(
                    json.dumps(
                        {
                            "schema_name": schema_name,
                            "version": current_version,
                            "status": with_status,
                            "schema": raw_schema,
                            "edited_by": username,
                            "realm": self.realm,
                            "title": title,
                        }
                    )
                )

        if with_status == "published":
            # First see what the origin could be: for example is there a draft version or not
            # if so we need to re-use the version from that draft version
            # if there is no draft version, check if there is an (older) published version en rename it by
            # removing the "published" attribute in the filename and calculate a new version
            if draft_file_name := current_schema_info["draft_name"]:
                draft_file: Path = self._get_schema_path(schema_name) / draft_file_name
                draft_file.unlink()
            if published_file_name := current_schema_info["published_name"]:
                published_file: Path = (
                    self._get_schema_path(schema_name) / published_file_name
                )
                published_file.rename(
                    published_file_name.replace("-published.json", ".json")
                    # edit the metadata status to archived
                )

            new_published_file = (
                self._get_schema_path(schema_name)
                / f"{schema_name}-v{current_version}-published.json"
            )

            new_published_file.write_text(
                json.dumps(
                    {
                        "schema_name": schema_name,
                        "version": current_version,
                        "status": with_status,
                        "schema": raw_schema,
                        "edited_by": g.irods_session.username,
                        "realm": self.realm,
                        "title": title,
                    }
                )
            )

        # return super().store_schema(**kwargs)

    def archive_published_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if published_file_name := current_schema_info["published_name"]:
            published_file: Path = (
                self._get_schema_path(schema_name) / published_file_name
            )
            published_file.rename(
                published_file_name.replace("-published.json", ".json")
                # also change the status to archived
            )
            return True
        else:
            return False

    def check_and_sanitize_schema(self, schema_name: str):
        current_schema_info = self.get_schema_info(schema_name)
        if current_schema_info["total_count"] == 0:
            current_schema_path = self._get_realm_schemas_path() / schema_name
            current_schema_path.unlink(True)
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


schema_managers = {}


def get_schema_manager(zone: str, realm: str) -> FileSystemSchemaManager:
    global schema_managers
    if zone_realm_key := f"{zone}-{realm}" not in schema_managers:
        schema_managers[zone_realm_key] = FileSystemSchemaManager(zone, realm)

    return schema_managers[zone_realm_key]
