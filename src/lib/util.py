def generate_breadcrumbs(path_string):
    breadcrumbs = []
    path_elements = path_string.strip("/").split("/")
    for idx, path_element in enumerate(path_elements):
        breadcrumbs.append(
            {"label": path_element, "url": "/".join(path_elements[: idx + 1])}
        )
    return breadcrumbs
