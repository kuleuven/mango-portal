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
