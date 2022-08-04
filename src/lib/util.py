import os


def generate_breadcrumbs(path_string):
    breadcrumbs = []
    path_elements = path_string.strip("/").split("/")
    for idx, path_element in enumerate(path_elements):
        breadcrumbs.append(
            {"label": path_element, "url": "/".join(path_elements[: idx + 1])}
        )
    return breadcrumbs


def collection_tree_to_dict(collection):
    (_, label) = os.path.split(collection.path)
    d = {"id": collection.path, "label": label}
    if collection.subcollections:
        d["children"] = [
            collection_tree_to_dict(subcollection)
            for subcollection in collection.subcollections
        ]
    return d


def strip_suffix(_string: str, _suffix: str):
    if _string.endswith(_suffix):
        _string = _string[: -len(_suffix)]
    return _string

def flatten_josse_schema(object_tuple, level=0, prefix="", result_dict={}):
    """
    """
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

    # print(f"level: {level}")
    # pprint(result_dict)
    return result_dict
