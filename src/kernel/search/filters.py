from datetime import datetime
from irods.models import (
    Collection,
    DataObject,
    DataObjectMeta,
    CollectionMeta,
)

from irods.column import Criterion, Like


def build_basic_query_filters(form):
    """

    {'avus-0-meta_a': '',
     'avus-0-meta_u': '',
     'avus-0-meta_v': '',
     'avus-1-meta_a': '',
     'avus-1-meta_u': '',
     'avus-1-meta_v': '',
     'create_date-comparison': 'before',
     'create_date-date': '',
     'csrf_token': 'IjlmZDc4OTFlNzdiOTYyNzg1NWI4Zjc0YTBjM2NkMzNkZDRmNWQwNjki.YjIKRA.SmWr4OGmq8iz-zTIVGTPg1fMj-c',
     'item_name-comparison': 'contains',
     'item_name-item_name': '',
     'item_name-item_type': 'data_object',
     'mod_date-comparison': 'before',
     'mod_date-date': '',
     'submit': 'Search'}

    """
    filters = []
    # avoid the replicated data objects
    if form["item_name-item_type"] == "data_object":
        filters += [Criterion("=", DataObject.replica_number, 0)]

    if form["item_name-item_name"]:
        crit = "="  # HAD TO FIX BECAUSE IT COULD BE LEFT UNSET
        name = form["item_name-item_name"]
        try:
            if form["item_name-comparison"] == "y":
                crit = "="
                name = form["item_name-item_name"]
        except:
            crit = "like"
            name = f"%{form['item_name-item_name']}%"

        column = DataObject.name
        if form["item_name-item_type"] == "collection":
            column = Collection.name
        filters += [Criterion(crit, column, name)]

    column_meta_base = (
        DataObjectMeta
        if form["item_name-item_type"] == "data_object"
        else CollectionMeta
    )

    try:
        if form[f"schema_metadata-meta_a"]:
            filters += [
                Criterion("=", column_meta_base.name, form[f"schema_metadata-meta_a"])
            ]

        if form[f"schema_metadata-meta_v"]:
            comparison = (
                "like" if form[f"schema_metadata-meta_v"].find("%") != -1 else "="
            )
            filters += [
                Criterion(
                    comparison, column_meta_base.value, form[f"schema_metadata-meta_v"]
                )
            ]
    except:
        pass

    # for num in [1, 2, 3]:
    num = 0
    while True:
        try:
            if form[f"schema_metadata-{num}-meta_a"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"schema_metadata-{num}-meta_a"],
                    )
                ]

            if form[f"schema_metadata-{num}-meta_v"]:
                comparison = (
                    "like"
                    if form[f"schema_metadata-{num}-meta_v"].find("%") != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"schema_metadata-{num}-meta_v"],
                    )
                ]

            # if form[f"any_avu{num}-meta_u"]:
            #     comparison = "like" if form[f"any_avu{num}-meta_u"].find("%") != -1 else "="
            #     filters += [
            #         Criterion(
            #             comparison, column_meta_base.units, form[f"any_avu{num}-meta_u"]
            #         )
            #     ]
            num += 1
        except:
            break

    num = 0
    while True:
        try:
            if form[f"non_schema_metadata-{num}-meta_a"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"non_schema_metadata-{num}-meta_a"],
                    )
                ]

            if form[f"non_schema_metadata-{num}-meta_v"]:
                comparison = (
                    "like"
                    if form[f"non_schema_metadata-{num}-meta_v"].find("%") != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"non_schema_metadata-{num}-meta_v"],
                    )
                ]

            if form[f"non_schema_metadata-{num}-meta_u"]:
                comparison = (
                    "like"
                    if form[f"non_schema_metadata-{num}-meta_u"].find("%") != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"non_schema_metadata-{num}-meta_u"],
                    )
                ]

            num += 1
        except:
            break

    if form["create_date-date"]:
        column = (
            DataObject.create_time
            if form["item_name-item_type"] == "data_object"
            else Collection.create_time
        )
        comparison = ">=" if form["create_date-comparison"] == "after" else "<="
        filters += [
            Criterion(
                comparison, column, datetime.fromisoformat(form["create_date-date"])
            )
        ]
        # filters += [(column >= datetime.fromisoformat(form["create_date-date"]))]

    if form["mod_date-date"]:
        column = (
            DataObject.create_time
            if form["item_name-item_type"] == "data_object"
            else Collection.create_time
        )
        comparison = ">=" if form["mod_date-comparison"] == "after" else "<="
        filters += [
            Criterion(comparison, column, datetime.fromisoformat(form["mod_date-date"]))
        ]

    if (
        "collection_subtree-collection" in form.keys()
    ):  # HAD TO FIX BECAUSE IT BROKE IF KEY WAS MISSING
        if form["item_name-item_type"] == "collection":

            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

        else:
            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

    return filters


def get_criterion(user_input: str, column) -> Criterion:
    comparison = "like" if user_input.find("%") != -1 else "="
    return Criterion(comparison, column, user_input)


def build_basic_query_filters_refactored(form):
    filters = []

    # constant form keys
    ITEM_TYPE = "item_name-item_type"  # data_object or collection
    ITEM_NAME = "item_name-item_name"
    ITEM_NAME_FULL_MATCH = "item_name-comparison"  # y or n
    METADATA_SCHEMA_PREFIX = "schema_metadata-"
    METADATA_NOSCHEMA_PREFIX = "non_schema_metadata-"
    SUBTREE = "collection_subtree-collection"

    # subtree
    if subtree := form.get(SUBTREE, None):
        filters += [Like(Collection.name, f"{subtree}%")]
    else:
        raise KeyError("Compulsory subtree is misisng.")

    # deal with item type
    if form[ITEM_TYPE] == "data_object":
        item_column = DataObject
        metadata_item_column = DataObjectMeta
        filters += [Criterion("=", DataObject.replica_number, 0)]
    else:
        item_column = Collection
        metadata_item_column = CollectionMeta

    # deal with item name
    if item_name := form.get(ITEM_NAME, None):
        item_name = item_name.strip()
        crit = "=" if form.get(ITEM_NAME_FULL_MATCH, None) == "y" else "like"
        item_name = f"%{item_name}%" if crit == "like" else item_name
        filters += [Criterion(crit, item_column.name, item_name)]

    # deal with schema metadata

    schema_attributes = [
        key
        for key in form.keys()
        if key.startswith(METADATA_SCHEMA_PREFIX) and key.endswith("meta_a")
    ]
    for attribute in schema_attributes:
        filters += [get_criterion(form[attribute], metadata_item_column.name)]
        if schema_value := form.get(attribute.replace("_a", "_v"), False):
            filters += [get_criterion(schema_value, metadata_item_column.value)]

    # deal with non-schema metadata

    METADATA_SUFFIX_PART_MAPPING = {
        "a": metadata_item_column.name,
        "v": metadata_item_column.value,
        "u": metadata_item_column.units,
    }

    non_schema_indices = set(
        [
            key.split("-")[1]
            for key in form.keys()
            if key.startswith(METADATA_NOSCHEMA_PREFIX)
        ]
    )
    for idx in non_schema_indices:  # loop over existing indices
        for (
            suffix,
            avu_part,
        ) in METADATA_SUFFIX_PART_MAPPING.items():  # loop over name/value/unit
            if form_value := form.get(
                f"{METADATA_NOSCHEMA_PREFIX}{idx}-meta_{suffix}", False
            ):
                filters += [get_criterion(form_value, avu_part)]

    # deal with dates
    DATE_FORM_MAPPING = {
        "create_date": item_column.create_time,
        "mod_date": item_column.modify_time,
    }

    for form_item, column_name in DATE_FORM_MAPPING.items():
        if form_value := form.get(f"{form_item}-date", False):
            comparison = ">=" if form[f"{form_item}-comparison"] == "after" else "<="
            filters += [
                Criterion(comparison, column_name, datetime.fromisoformat(form_value))
            ]

    return filters


if __name__ == "__main__":
    example_form_dict = {
        "collection_subtree-collection": "/zone/home/project/subcollection",
        "non_schema_metadata-0-meta_a": "some_attr",
        "non_schema_metadata-0-meta_v": "some_val",
        "non_schema_metadata-0-meta_u": "some_unit",
        "schema_metadata-0-meta_a": "mgs.schema_name.field",
        "schema_metadata-0-meta_v": "value1",
        "schema_metadata-2-meta_a": "mgs.other_schema.other_field",
        "schema_metadata-2-meta_v": "value2",
        "create_date-comparison": "before",
        "create_date-date": "2025-10-01",
        "csrf_token": "IjlmZDc4OTFlNzdiOTYyNzg1NWI4Zjc0YTBjM2NkMzNkZDRmNWQwNjki.YjIKRA.SmWr4OGmq8iz-zTIVGTPg1fMj-c",
        "item_name-comparison": "contains",
        "item_name-item_name": "name_piece",
        "item_name-item_type": "data_object",
        "mod_date-comparison": "before",
        "mod_date-date": "",
        "submit": "Search",
    }
    old_filters = build_basic_query_filters(example_form_dict)

    print("With the old version of the code, we get the following filters:")
    for filter in old_filters:
        print(f"{filter.query_key.icat_key} {filter.op} {filter.value}")

    new_filters = build_basic_query_filters_refactored(example_form_dict)

    print("======\nWith the new version we get the following filters:")
    for filter in new_filters:
        print(f"{filter.query_key.icat_key} {filter.op} {filter.value}")
