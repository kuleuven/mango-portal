from crypt import methods
from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    g,
    send_file,
    abort,
    stream_with_context,
    Response,
    request,
    flash,
    jsonify,
)
import json
from flask_wtf import Form, FlaskForm
from wtforms import (
    StringField,
    SelectField,
    validators,
    SubmitField,
    HiddenField,
    FieldList,
    FormField,
    DateField,
    Form,
    SelectMultipleField,
    RadioField,
    BooleanField,
)

from cache import cache
from lib.util import (
    collection_tree_to_dict,
    flatten_schema,
)

from pprint import pprint
from irods.models import (
    Collection,
    DataObject,
    DataObjectMeta,
    CollectionMeta,
    UserMeta,
)
from irods.session import iRODSSession
from irods.query import Query
from irods.column import Criterion, Like
from datetime import datetime
from flask_paginate import Pagination, get_page_parameter

from kernel.template_overrides import get_template_override_manager

from kernel.metadata_schema import get_schema_manager  # , SchemaManager
from mango_mdschema import helpers
from multidict import MultiDict
from wtforms.widgets import html_params


basic_search2_bp = Blueprint("basic_search2_bp", __name__, template_folder="templates")

from mango_ui import register_module


UI = {
    "title": "Search",
    "bootstrap_icon": "search",
    "description": "Catalog search",
    "blueprint": basic_search2_bp.name,
    "index": "catalog_search2",
}

register_module(**UI)

irods_comparison_operator = {
    "after": ">=",
    "equal": "=",
    "before": "<=",
    "contains": "like",
}

# hidden_tag = HiddenField()


# ---------------------- filters ---------------------------- #


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
        # crit = "="
        # name = form["item_name-item_name"]
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

    # if form["any_avu-meta_a"]:
    #     filters += [Criterion("=", column_meta_base.name, form["any_avu-meta_a"])]

    # if form["any_avu-meta_v"]:
    #     comparison = "like" if form["any_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, column_meta_base.value, form["any_avu-meta_v"])
    #     ]

    # if form["any_avu-meta_u"]:
    #     comparison = "like" if form["any_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, column_meta_base.units, form["any_avu-meta_u"])
    #     ]

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
            if form[f"schema_metadata_no_label-{num}-meta_a"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"schema_metadata_no_label-{num}-meta_a"],
                    )
                ]

            if form[f"schema_metadata_no_label-{num}-meta_v"]:
                comparison = (
                    "like"
                    if form[f"schema_metadata_no_label-{num}-meta_v"].find("%") != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"schema_metadata_no_label-{num}-meta_v"],
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

    if form[f"non_schema_metadata-meta_attribute"]:
        filters += [
            Criterion(
                "=", column_meta_base.name, form[f"non_schema_metadata-meta_attribute"]
            )
        ]

    if form[f"non_schema_metadata-meta_value"]:
        comparison = (
            "like" if form[f"non_schema_metadata-meta_value"].find("%") != -1 else "="
        )
        filters += [
            Criterion(
                comparison,
                column_meta_base.value,
                form[f"non_schema_metadata-meta_value"],
            )
        ]

    num = 0
    while True:
        try:
            if form[f"non_schema_metadata_no_label-{num}-meta_attribute"]:
                filters += [
                    Criterion(
                        "=",
                        column_meta_base.name,
                        form[f"non_schema_metadata_no_label-{num}-meta_attribute"],
                    )
                ]

            if form[f"non_schema_metadata_no_label-{num}-meta_value"]:
                comparison = (
                    "like"
                    if form[f"non_schema_metadata_no_label-{num}-meta_value"].find("%")
                    != -1
                    else "="
                )
                filters += [
                    Criterion(
                        comparison,
                        column_meta_base.value,
                        form[f"non_schema_metadata_no_label-{num}-meta_value"],
                    )
                ]

            num += 1
        except:
            break

    # if form["collection_avu-meta_a"]:
    #     filters += [Criterion("=", CollectionMeta.name, form["collection_avu-meta_a"])]

    # if form["collection_avu-meta_v"]:
    #     comparison = "like" if form["collection_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, CollectionMeta.value, form["collection_avu-meta_v"])
    #     ]

    # if form["collection_avu-meta_u"]:
    #     comparison = "like" if form["collection_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, CollectionMeta.units, form["collection_avu-meta_u"])
    #     ]

    # if form["data_object_avu-meta_a"]:
    #     filters += [Criterion("=", DataObjectMeta.name, form["data_object_avu-meta_a"])]

    # if form["data_object_avu-meta_v"]:
    #     comparison = "like" if form["data_object_avu-meta_v"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, DataObjectMeta.value, form["data_object_avu-meta_v"])
    #     ]

    # if form["data_object_avu-meta_u"]:
    #     comparison = "like" if form["data_object_avu-meta_u"].find("%") != -1 else "="
    #     filters += [
    #         Criterion(comparison, DataObjectMeta.value, form["data_object_avu-meta_u"])
    #     ]

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

    if form["collection_subtree-collection"]:
        if form["item_name-item_type"] == "collection":

            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

        else:
            filters += [
                Like(Collection.name, f"{form['collection_subtree-collection']}%")
            ]

    return filters


def get_realm_schemas(realm):

    schema_manager: SchemaManager = get_schema_manager(
        zone=g.irods_session.zone, realm=realm
    )

    my_schemas = schema_manager.list_schemas(
        filters=["published"]
    )  # TODO archived schemas should also be searchable ...

    existing_schemas = {
        schema_name: schema["title"] for schema_name, schema in my_schemas.items()
    }
    if not existing_schemas:
        return None

    schemas_dict = {
        k: [] for k in existing_schemas.keys()
    }  # transformed schemas dictionary to feed Advanced Search

    for schema in existing_schemas.keys():
        schema_dict = json.loads(schema_manager.load_schema(schema))

        flattened_schema = flatten_schema(
            schema_dict,
            level=0,
            prefix=f"mgs.{schema}",
            result_dict={},
            add_enum=True,
        )

        # print("this is the schema:", flattened_schema)
        def create_path_label(key):
            parts = key.split(".")
            ids = parts[2:]
            label_list = [
                flattened_schema[".".join(parts[:2] + ids[: i + 1])][
                    "label"
                ]  # add +1 here because range starts from 0
                for i in range(len(ids))
            ]
            return " / ".join(label_list)

        for key, value in flattened_schema.items():

            restructured_item = {
                key: {
                    "type": ("label" if value["type"] == "object" else value["type"]),
                    "enum": (value.get("enum", None)),
                    "level": value["level"],
                    "parent": (
                        None
                        if value["level"] == 0
                        else flattened_schema[".".join(str(key).split(".")[:-1])][
                            "label"
                        ]
                    ),
                    "title": f"{value['label']}",  # actual title
                    "display_label": (
                        create_path_label(key) if value["type"] == "object" else "none"
                    ),  # label with hierarchy for display in select
                }
            }
            schemas_dict[schema].append(
                restructured_item
            )  # put all schemas together in one schemas_dict

    # print(f"These are all schemas dictionaries:: {json.dumps(schemas_dict)}")
    if len(existing_schemas) == 0:
        existing_schemas = {"no_schemas": "no schemas found"}
    return existing_schemas, schema_dict


@basic_search2_bp.route("/catalog/search2", methods=["GET", "POST"])
def catalog_search2():

    # cache for 5 minutes using all the arguments as a key, user specific!
    @cache.memoize(300)
    def get_meta_attribute_names(type=DataObjectMeta.name, user=None, zone=None):
        current_app.logger.info(
            f"Creating/refreshing metadata attribute (name) cache for user {user}"
        )
        return g.irods_session.query(type).all()

    # -------------------------- schemas --------------------------- #

    home = f"/{g.irods_session.zone}/home"
    # allow querying for schemas of any realm the user has access to
    realm_schemas = {
        coll.name: get_realm_schemas(coll.name)
        for coll in g.irods_session.collections.get(home).subcollections
    }

    existing_schemas = {
        k: v
        for schema in realm_schemas.values()
        if schema is not None
        for k, v in schema[0].items()
    }
    schemas_dict = {
        k: v
        for schema in realm_schemas.values()
        if schema is not None
        for k, v in schema[1].items()
    }

    # -------------------------- form --------------------------- #

    class ButtonWidget(object):
        """
        Renders a multi-line text area.
        `rows` and `cols` ought to be passed as keyword args when rendering.
        """

        input_type = "button"

        html_params = staticmethod(html_params)

        def __call__(self, field, **kwargs):
            kwargs.setdefault("id", field.id)
            kwargs.setdefault("type", self.input_type)
            if "value" not in kwargs:
                kwargs["value"] = field._value()
            params = self.html_params(name=field.name, **kwargs)
            label = '<i class="bi bi-trash"></i>'  # field.label.text

            return f"""<button {params}>{label}</button>"""

    class ButtonField(StringField):
        widget = ButtonWidget()

    class AVUForm(Form):
        """AVU input field basic and label."""

        meta_attribute = StringField("Attribute name")  # , [validators.Length(min=2)])
        meta_value = StringField("Attribute value")  # , [validators.Length(min=2)])
        meta_unit = StringField("Unit value")  # , [validators.Length(min=2)])
        remove = ButtonField("      ")

        # data object variant with <data> search suggestions

    class AVUFormNoLabel(Form):
        """AVU input no label."""

        meta_attribute = StringField("")
        meta_value = StringField("")
        meta_unit = StringField("")  # , [validators.Length(min=2)])
        remove = ButtonField("")

    class AVUSchema(Form):
        """Input field for schema metadata with suggestion list and label."""

        schema = SelectField(
            "Schema",
            validate_choice=False,
            choices=list(existing_schemas.items()),
        )

        # meta_a = StringField("Attribute name", render_kw={"list": "search_meta_names"})
        meta_a = SelectField(
            "Attribute name", validate_choice=False
        )  # we don't validate because choices will be created dynamically
        meta_v = StringField("Attribute value")
        remove = ButtonField("      ")

    class AVUSchemaNoLabel(Form):
        """AVU field for schema metadata with suggestion list and no label."""

        schema = SelectField(
            "",
            validate_choice=False,
            choices=list(existing_schemas.items()),
            render_kw={"data-target": "meta-schema"},
        )

        # meta_a = StringField("", render_kw={"list": "search_meta_names"})
        meta_a = SelectField(
            "", validate_choice=False, render_kw={"data-target": "meta-attribute"}
        )
        meta_v = StringField("", render_kw={"data-target": "meta-value"})
        remove = ButtonField("")

    # # data object variant with <data> search suggestions
    # class AVUFormSuggestionListDO(Form):
    #     meta_a = StringField(
    #         "Attribute name", render_kw={"list": "do_search_meta_names"}
    #     )
    #     meta_v = StringField("Attribute value")
    #     meta_u = StringField("Attribute unit")

    # # collection variant with <data> search suggestions
    # class AVUFormSuggestionListCO(Form):
    #     meta_a = StringField(
    #         "Attribute name", render_kw={"list": "co_search_meta_names"}
    #     )
    #     meta_v = StringField("Attribute value")
    #     meta_u = StringField("Attribute unit")

    class ItemDateForm(Form):
        """Fields for date."""

        comparison = SelectField(
            "Comparison",
            choices=[("before", "Before"), ("after", "After")],
            validate_choice=False,
        )
        date = DateField(
            label="Date", format="%Y-%m-%d", validators=[validators.Optional()]
        )

    class ItemTypeNameForm(Form):
        """Fields for Type, Name and Exact Match."""

        item_name = StringField(
            "Specify name",
            render_kw={
                "placeholder": "Enter the name of the data object or collection"
            },
        )

        item_type = RadioField(
            "Choose data type",  # add any option
            choices=[
                ("data_object", "Data object"),
                ("collection", "Collection"),
            ],
            default="data_object",
            # validate_choice=False,
        )

        comparison = BooleanField("Exact match")

    # create a list of first level collections to refine the search
    base = g.irods_session.collections.get(f"/{g.irods_session.zone}/home")
    subtrees = [base.path] + [collection.path for collection in base.subcollections]
    user_home = f"{g.irods_session.zone}/home/{g.irods_session.username}"

    class CollectionForm(Form):
        """Select field with possible collections."""

        collection = SelectField(
            "Choose collection",
            validate_choice=False,
            choices=subtrees,
        )

    class CatalogSearchForm(Form):
        """Class for catalog search form."""

        item_name = FormField(ItemTypeNameForm, label="Name")
        collection_subtree = FormField(CollectionForm, label="Subtree filter")
        create_date = FormField(ItemDateForm, label="Created")
        mod_date = FormField(ItemDateForm, label="Modified")
        schema_metadata = FormField(AVUSchema, label="Metadata")
        schema_metadata_no_label = FieldList(
            FormField(AVUSchemaNoLabel),
            min_entries=0,
        )
        non_schema_metadata = FormField(AVUForm, label="Non schema metadata")
        non_schema_metadata_no_label = FieldList(
            FormField(AVUFormNoLabel),
            min_entries=0,
        )

        per_page = HiddenField("per_page")
        total = HiddenField("total")
        submit = SubmitField("Search")

        # data_object_avu = FormField(
        #     AVUFormSuggestionListDO, label="Data object metadata"
        # )
        # collection_avu = FormField(
        #     AVUFormSuggestionListCO, label="Collection metadata"
        # )

    # ------------------ ??????????? --------------------- #

    current_app.logger.info(request.values)
    data_object_meta_names = get_meta_attribute_names(
        DataObjectMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    )
    # collection_meta_names = get_meta_attribute_names(
    #     CollectionMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    # )
    # user_meta_names = get_meta_attribute_names(
    #     UserMeta.name, user=g.irods_session.username, zone=g.irods_session.zone
    # )
    meta_names = []
    current_app.logger.info(
        f"Got {data_object_meta_names.length} items for data objects"
    )
    for item in data_object_meta_names:
        meta_names.append(item[DataObjectMeta.name])
        # pprint(item)
    # pprint(meta_names)
    # print(f"Got {collection_meta_names.length} items for collections")
    # for item in collection_meta_names:
    #     pprint(item)
    # print(f"Got {user_meta_names.length} items for users")
    # for item in user_meta_names:
    #     pprint(item)

    # collection_tree = json.dumps(
    #     [collection_tree_to_dict(g.irods_session.collections.get(g.user_home))]
    # )

    # pprint(cache)
    search_form = CatalogSearchForm(formdata=request.values, per_page=20)

    # print(search_form.validate())

    # ----------------------- run search -------------------- #

    # print(request.values)

    print(request.values.to_dict())

    #this dictionary is used to create the fields on page reload
    no_label_fields = list(
        set([k[-8] for k in request.values.to_dict() if "no_label" in k])
    )
    #TODO: make more robust: currently it filters string -8 (-schema, -meta_a, -meta_v) and then removes duplicates by creating a set
    no_label_fields_dict = {f"no_label_{v}": v for v in no_label_fields}

    if request.values.get("submit", False) == "Search" and search_form.validate():
        import time

        start = time.time()
        filters = build_basic_query_filters(request.values)
        objects = (
            [Collection.name, Collection.owner_name]
            if request.values["item_name-item_type"] == "collection"
            else [
                Collection.name,
                DataObject.name,
                DataObject.size,
                DataObject.owner_name,
            ]
        )
        # objects = (
        #     Collection
        #     if request.values["item_name-item_type"] == "collection"
        #     else
        #         DataObject,

        # )
        page = request.values.get("page", 1, int)
        limit = 20  # request.values.get("per_page", 20, int)
        offset = (page - 1) * limit
        pprint(request.values)
        current_app.logger.info(f"Query with offset {offset}, limit {limit}")

        query = (
            Query(g.irods_session, *objects)
            .filter(*filters)
            .limit(limit)
            .offset(offset)
        )

        if True:  # "page" not in request.values or not request.values["total"]:
            total_query_object = (
                Collection.id
                if request.values["item_name-item_type"] == "collection"
                else DataObject.id
            )
            filters = filters.copy()
            total_query = (
                Query(g.irods_session, total_query_object)
                .filter(*filters)
                .count(total_query_object)
            )
            total_results = total_query.execute()
            print(f"totals:")
            print(total_results)
            for r in total_results:
                print(f"TOTAL = {r[total_query_object]}")
            print("end totals")
            total = int(total_results[0][total_query_object])
            # if request.values["item_name-item_type"] == "data_object":
            #     total = int(total / 2)
            current_app.logger.info(f" total results is {total}")
            # rebuild the search form
            # search_form = CatalogSearchForm(
            #     formdata=request.values, per_page=20, total=total
            # )

        else:
            total = int(request.values["total"])
            current_app.logger.info(f"Re-using the request total parameter: {total}")

        current_app.logger.info(f"Assigned to total hidden field: {total}")
        search_form.total.data = total
        pprint(search_form.total)

        # pprint(query)

        # search_query.limit = 20
        # search_query.offset = 0

        # pprint(query._message())
        try:
            results = query.execute()
        except Exception as error:
            print(f"Error during search", error)
            flash(f"The server returned an error: {error}", category="danger")
            return render_template(
                "basic_catalog_search.html.j2",
                search_form=search_form,
                # collection_tree=collection_tree,
                results=[],
            )

        end = time.time()  # right time
        dict_results = []
        for r in results:
            if request.values["item_name-item_type"] == "collection":
                dict_results.append(
                    {
                        "type": "collection",
                        "name": r[Collection.name],
                        "owner": r[Collection.owner_name],
                    }
                )
            else:
                dict_results.append(
                    {
                        "type": "data_object",
                        "path": r[Collection.name],
                        "name": r[DataObject.name],
                        "size": r[DataObject.size],
                        "owner": r[DataObject.owner_name],
                    }
                )
        # pprint(dict_results)
        pagination = Pagination(
            page=page,
            per_page=limit,
            total=total,
            # search=True,
            record_name="items",
            css_framework="bootstrap5",
            # show_single_page=True,
        )
        # pprint(pagination)

        search_template = "search/basic_catalog_search.html.j2"

        if current_collection := request.values.get(
            "collection_subtree-collection", None
        ):
            search_template = get_template_override_manager(
                g.irods_session.zone
            ).get_template_for_catalog_item(
                g.irods_session.collections.get(current_collection),
                "search/basic_catalog_search.html.j2",
            )

        return render_template(
            search_template,
            search_form=search_form,
            results=results,
            total=total,
            dict_results=dict_results,
            # collection_tree=collection_tree,
            search_time=end - start,
            meta_names=meta_names,
            pagination=pagination,
            schemas_dict=schemas_dict,
            existing_schemas=existing_schemas,
            search_fields=request.values.to_dict(),
            no_label_fields_dict=no_label_fields_dict,
        )

    else:

        return render_template(
            "search/basic_catalog_search.html.j2",
            search_form=search_form,
            results=[],
            meta_names=meta_names,
            # collection_tree=collection_tree,
            schemas_dict=schemas_dict,
            existing_schemas=existing_schemas,
            search_fields={},
            no_label_fields_dict={},
        )
