import os
from irods.collection import iRODSCollection
from irods.data_object import iRODSDataObject
from irods.session import iRODSSession
import base64


def generate_breadcrumbs(path_string: str):
    breadcrumbs = []
    path_elements = path_string.strip("/").split("/")
    for idx, path_element in enumerate(path_elements):
        breadcrumbs.append(
            {"label": path_element, "url": "/".join(path_elements[: idx + 1])}
        )
    return breadcrumbs


def collection_tree_to_dict(collection: iRODSCollection, level=0):
    (_, label) = os.path.split(collection.path)
    d = {"id": collection.path, "label": label}
    if collection.subcollections and level < 3 and len(collection.collections) < 100:
        level += 1
        d["children"] = [
            collection_tree_to_dict(subcollection, level)
            for subcollection in collection.subcollections
        ]
    return d


def strip_suffix(_string: str, _suffix: str):
    if _string.endswith(_suffix):
        _string = _string[: -len(_suffix)]
    return _string


def flatten_josse_schema(object_tuple, level=0, prefix="", result_dict={}):
    """ """
    (_key, _dict) = object_tuple
    for p_key, _property in _dict["properties"].items():
        # Preprocessing/sanitizing
        # Checkboxes type
        if p_key.endswith("_checkboxes"):
            # chop off the type from the label
            p_key = p_key[: -len("_checkboxes")]
            # put the type where it belongs
            _property["type"] = "checkboxes"
        # select or radio buttons: presence of enum list an its size
        if "enum" in _property:
            _property["type"] = "select" if len(_property["enum"]) >= 5 else "radio"
        # Real processing: either get a new (possible composite field) or walk down a child object

        if _property["type"] == "object":
            result_dict = flatten_josse_schema(
                (p_key, _property),
                level=(level + 1),
                prefix=f"{prefix}.{p_key}",
                result_dict=result_dict,
            )

        else:

            result_dict[f"{prefix}.{p_key}"] = {
                "label": _property["title"],
                "type": _property["type"],
            }

    return result_dict


def flatten_schema(object_tuple, level=0, prefix="", result_dict={}):
    (_key, _dict) = object_tuple
    for p_key, _property in _dict["properties"].items():
        result_dict[f"{prefix}.{p_key}"] = {
            "label": _property["title"],
            "type": _property["type"],
            "level": level,
        }

        if _property["type"] == "object":
            result_dict = flatten_schema(
                (p_key, _property),
                level=(level + 1),
                prefix=f"{prefix}.{p_key}",
                result_dict=result_dict,
            )

    return result_dict


def get_collection_size(collection: iRODSCollection):
    total_size = 0
    num_data_objects = 0
    try:
        for info in collection.walk():
            num_data_objects += len(info[2])
            total_size += sum(d.size for d in info[2])
    except Exception:
        total_size_in_bytes = -1
    return {"total_size": total_size, "num_data_objects": num_data_objects}


def current_user_is_naked_owner(irods_session: iRODSSession, catalog_item):
    permissions = irods_session.permissions.get(catalog_item, report_raw_acls=True)
    for permission in permissions:
        if (
            irods_session.username == permission.user_name
            and permission.access_name == "own"
        ):
            return True
    return False


def mimic_atomic_operations(
    catalog_item: iRODSDataObject | iRODSCollection, avu_operations
):
    for avu_operation in avu_operations:
        if avu_operation.operation == "remove":
            catalog_item.metadata.remove(avu_operation.avu)
        if avu_operation.operation == "add":
            catalog_item.metadata.add(avu_operation.avu)


# Workaround for a bug if current user is not an explicit owner, atomic operations fail in PRC 1.1.5
def execute_atomic_operations(
    irods_session: iRODSSession,
    catalog_item: iRODSDataObject | iRODSCollection,
    avu_operations,
):
    if current_user_is_naked_owner(irods_session, catalog_item):
        catalog_item.metadata.apply_atomic_operations(*avu_operations)
    else:
        mimic_atomic_operations(catalog_item, avu_operations)


def get_type_for_path(irods_session: iRODSSession, item_path: str):
    try:
        _ = irods_session.collections.get(item_path)
        return "collection"
    except Exception:
        return "data_object"


# equivalents to javascript btoa and atob
def btoa(x):
    return base64.b64encode(bytes(x, "utf-8")).decode("utf-8")


def atob(x):
    return base64.b64decode(x)
