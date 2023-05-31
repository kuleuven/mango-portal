from curses import meta
import flask
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
)

from irods.meta import iRODSMeta
from irods.access import iRODSAccess
import irods.keywords
from irods.data_object import iRODSDataObject
from irods.collection import iRODSCollection
from irods.session import iRODSSession
from irods.path import iRODSPath

from PIL import Image
from pdf2image import convert_from_path
import mimetypes
import tempfile
from urllib.parse import unquote

from lib.util import (
    generate_breadcrumbs,
    flatten_josse_schema,
    get_collection_size,
    flatten_schema,
)
import magic
import os
import glob
import json
import requests
import pprint
import tempfile
import re
import datetime
import time
from collections import Counter, namedtuple
from cache import cache
import logging
import irods_session_pool
from multidict import MultiDict
from operator import itemgetter
from pathlib import PurePath

from kernel.metadata_schema import get_schema_manager
from kernel.template_overrides import get_template_override_manager

browse_bp = Blueprint("browse_bp", __name__, template_folder="templates")

from mango_ui import register_module

UI = {
    "title": "Collections",
    "bootstrap_icon": "folder",
    "description": "Browse your collections",
    "blueprint": browse_bp.name,
    "index": "collection_browse",
}

register_module(**UI)
# proxy so it can also be imported in blueprints from csrf.py independently
from csrf import csrf

from kernel.metadata_schema.editor import get_metadata_schema_dir
import signals

# rudimentary code to obtain schema realm (project) from url


def get_realm(item: iRODSCollection | iRODSDataObject) -> str:
    realm = False
    item_path = item.path
    path_elements = item_path.split("/")
    if (len(path_elements) >= 4) and path_elements[2] in ["home", "projects"]:
        realm = path_elements[3]
    else:
        logging.warn(f"No realm for {item_path}")
    return realm


def group_prefix_metadata_items(
    metadata_items,
    mango_prefix,
    no_schema_label="other",
    group_analysis_unit=False,
):
    """ """
    grouped_metadata = {no_schema_label: MultiDict()}
    if group_analysis_unit:
        grouped_metadata["analysis"] = MultiDict()
    for avu in metadata_items:
        if avu.name.startswith(mango_prefix) and avu.name.count(".") >= 2:
            (mango_schema_prefix, schema, avu_name) = avu.name.split(".", 2)
            # item.name = meta_name
            if schema not in grouped_metadata:
                grouped_metadata[schema] = MultiDict()
            if not avu.units:
                grouped_metadata[schema].add(avu.name, avu)
            else:
                # creating a dict with the ordinal string from avu.unit as key
                # chop off the last part to get the composite identifier
                composite_id = ".".join(avu.name.split(".")[:-1])
                if composite_id not in grouped_metadata[schema]:
                    grouped_metadata[schema].add(composite_id, {avu.units: MultiDict()})
                if avu.units not in grouped_metadata[schema][composite_id]:
                    grouped_metadata[schema][composite_id][avu.units] = MultiDict()
                grouped_metadata[schema][composite_id][avu.units].add(avu.name, avu)

        elif group_analysis_unit and avu.units and avu.units.startswith("analysis"):
            grouped_metadata["analysis"].add(avu.name, avu)
        else:
            grouped_metadata[no_schema_label].add(avu.name, avu)
    # sort the non schema lists by key
    grouped_metadata[no_schema_label] = MultiDict(
        sorted(grouped_metadata[no_schema_label].items(), key=itemgetter(0))
    )
    if "analysis" in grouped_metadata:
        grouped_metadata["analysis"] = MultiDict(
            sorted(grouped_metadata["analysis"].items(), key=itemgetter(0))
        )
    # if there are no consolidated metadata in the analysis group, delete the (empty) group
    if group_analysis_unit and len(grouped_metadata["analysis"]) == 0:
        del grouped_metadata["analysis"]
    return grouped_metadata


# @cache.memoize(1200)
def get_current_user_rights(current_user_name, item):
    access = []
    permissions = g.irods_session.permissions.get(item, report_raw_acls=False)

    # group_names: workaround for non expanding user groups for data objects
    group_names = []
    if current_user_name in irods_session_pool.irods_user_sessions:
        group_names = [
            group.name
            for group in irods_session_pool.irods_user_sessions[
                current_user_name
            ].my_groups
        ]
    for permission in permissions:
        if (
            current_user_name == permission.user_name
            or permission.user_name in group_names
        ):
            access += [permission.access_name]
    # pprint.pprint(access)
    return access


@browse_bp.route(
    "/collection/browse", defaults={"collection": None}, strict_slashes=False
)
@browse_bp.route("/collection/browse/<path:collection>")
def collection_browse(collection):
    """returns the list of objects and subcollections for the given
    collection.

    Arguments:

    collection: str or None
        a path string
        If None,the current user home dir will be used
        if the collection path starts with a ~ character, the remaining is appended to the user home directory

    """

    if collection == "~":
        co_path = g.user_home
    elif collection is None:
        co_path = g.zone_home
    else:
        co_path_elements = collection.split("/")
        prefix = "/"  # default
        if co_path_elements[0] == "~":
            prefix = g.user_home + "/"
            co_path_elements = co_path_elements.pop(0)
        co_path = prefix + "/".join(co_path_elements)

    try:
        current_collection = g.irods_session.collections.get(co_path)
    except:
        abort(404, "Path not found or not accessible for you")
    sub_collections = current_collection.subcollections
    data_objects = current_collection.data_objects

    ######################### new schema handling
    schemas = []
    schema_manager = False
    realm = ""
    if realm := get_realm(current_collection):
        schema_manager = get_schema_manager(g.irods_session.zone, realm)
    if schema_manager:
        schemas = schema_manager.list_schemas(filters=["published"])
        logging.info(
            f"Schema manager found published schemas: {'|'.join(schemas.keys())}"
        )
    # schema_names = schemas.keys()

    # schema_files = glob.glob(get_metadata_schema_dir(g.irods_session) + "/*.json")
    # metadata_schema_filenames = [
    #     base_file_name
    #     for template_file in schema_files
    #     if (base_file_name := os.path.basename(template_file)) != "uischema.json"
    # ]

    # metadata grouping  to be moved to proper function for re-use
    other = current_app.config["MANGO_NOSCHEMA_LABEL"]
    grouped_metadata = group_prefix_metadata_items(
        current_collection.metadata(timestamps=True).items(),
        current_app.config["MANGO_SCHEMA_PREFIX"],
    )

    schema_labels = {}
    if (
        len(grouped_metadata) == 1
        and current_app.config["MANGO_NOSCHEMA_LABEL"] in grouped_metadata
    ):
        pass
    else:
        # json_template_dir = get_metadata_schema_dir(g.irods_session)

        for schema in grouped_metadata:  # schema_labels[schema][item.name]:
            if schema != current_app.config["MANGO_NOSCHEMA_LABEL"] and schema_manager:
                try:
                    if version := grouped_metadata[schema].get(
                        f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{schema}.__version__",
                        "",
                    ):
                        logging.info(
                            f"Found version {version} for schema {schema} in metadata"
                        )
                        schema_dict = json.loads(
                            schema_manager.load_schema(
                                schema, status="", version=version.value
                            )
                        )
                    else:
                        schema_dict = json.loads(
                            schema_manager.load_schema(schema, status="published")
                        )

                    if schema_dict:
                        schema_labels[schema] = flatten_schema(
                            ("", schema_dict),
                            level=0,
                            prefix=f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{schema}",
                            result_dict={},
                        )
                        logging.info(
                            f"Flattened schema {schema}: {schema_labels[schema]}"
                        )
                    else:
                        logging.info(f"No labels found for {schema}")
                except Exception as e:
                    logging.info(
                        f"Encountered error loading schema {schema} for fetching labels {e}"
                    )
                    pass

        # now re-order the grouped entries according to the order from the flattened file
        # for schema in schema_labels:
        #    grouped_metadata[schema] = {}
    # pprint.pprint(grouped_metadata)
    # Now sort the metadata according to the schema definition
    sorted_metadata = {}
    # for schema in grouped_metadata:
    #     if schema in schema_labels:
    #         sorted_metadata[schema] = {}
    #         for meta_data_name in schema_labels[schema]:
    #             sorted_metadata[schema][meta_data_name] = grouped_metadata[schema].pop(
    #                 meta_data_name, ""
    #             )
    #     else:
    #         sorted_metadata[schema] = grouped_metadata[schema]
    # pprint.pprint(sorted_metadata)
    acl_users = []
    permissions = g.irods_session.permissions.get(
        current_collection, report_raw_acls=True, acl_users=acl_users
    )
    # print(f"Older permissions")
    # pprint.pprint(permissions)

    # permissions2 = g.irods_session.acls.get(current_collection)
    # print(f"New acls")
    # pprint.pprint(permissions2)

    acl_users_dict = {user.name: user.type for user in acl_users}
    acl_counts = Counter([permission.access_name for permission in permissions])

    my_groups = g.irods_session.my_groups
    # temp: look up metadata items in full, including create_time and modify_time
    from irods.query import Query
    from irods.column import Criterion, In
    from irods.models import CollectionMeta

    objects = [CollectionMeta]
    filters = []
    avu_ids = [metadata.avu_id for (_, metadata) in grouped_metadata[other].items()]
    metadata_objects = []
    if avu_ids:
        filters += [In(CollectionMeta.id, avu_ids)]

        query = Query(g.irods_session, *objects).filter(*filters)
        metadata_objects = query.execute()

    # end temp
    view_template = get_template_override_manager(
        g.irods_session.zone
    ).get_template_for_catalog_item(
        current_collection, "common/collection_view.html.j2"
    )
    logging.info(f"Collection view: using template {view_template}")
    user_trash_path = f"/{g.irods_session.zone}/trash/home/{g.irods_session.username}"

    return render_template(
        view_template,
        co_path=co_path,
        breadcrumbs=generate_breadcrumbs(co_path),
        collection=current_collection,
        sub_collections=sub_collections,
        data_objects=data_objects,
        permissions=permissions,
        acl_users=acl_users,
        acl_users_dict=acl_users_dict,
        acl_counts=acl_counts,
        realm=realm,
        # metadata_schema_filenames=metadata_schema_filenames,
        schemas=schemas,
        grouped_metadata=grouped_metadata,  # sorted_metadata,
        schema_labels=schema_labels,
        my_groups=my_groups,
        metadata_objects=metadata_objects,
        current_user_rights=get_current_user_rights(
            g.irods_session.username, current_collection
        ),
        user_trash_path=user_trash_path,
    )


@browse_bp.route("/data-object/view/<path:data_object_path>")
def view_object(data_object_path):
    """ """
    MIME_TYPE_ATTRIBUTE_NAME = f"{current_app.config['MANGO_PREFIX']}.mime_type"
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object: iRODSDataObject = g.irods_session.data_objects.get(data_object_path)
    current_user_rights = get_current_user_rights(g.irods_session.username, data_object)

    # meta_data_items = data_object.metadata.items()
    # if MIME_TYPE_ATTRIBUTE_NAME not in [item.name for item in meta_data_items]:
    if set(current_user_rights).intersection(set(["own", "write"])):
        try:
            mime_avu = data_object.metadata.get_one(MIME_TYPE_ATTRIBUTE_NAME)
        except:
            try:
                with data_object.open("r") as f:
                    blub = f.read(50 * 1024)  # read max 50k from data object
                mime_type = magic.from_buffer(blub, mime=True)
                mime_avu = iRODSMeta(MIME_TYPE_ATTRIBUTE_NAME, mime_type)
                data_object.metadata.set(mime_avu)
                # meta_data_items.append(mime_avu)
                logging.info(
                    f"mime-type was not set for object {data_object.path}, so we blubbed a bit into magic"
                )

            except:
                flash(
                    f"An error occurred with reading from {data_object_path}, mime type missing but could not be determined",
                    "warning",
                )
    ######################### new schema handling
    schemas = []
    schema_manager = False
    realm = ""
    if realm := get_realm(data_object):
        schema_manager = get_schema_manager(g.irods_session.zone, realm)
    if schema_manager:
        schemas = schema_manager.list_schemas(filters=["published"])
        logging.info(f"Schema manager found schemas: {'|'.join(schemas.keys())}")

    acl_users = []
    group_analysis_unit = True
    grouped_metadata = group_prefix_metadata_items(
        meta_data_items := data_object.metadata(timestamps=True).items(),
        current_app.config["MANGO_SCHEMA_PREFIX"],
        no_schema_label=current_app.config["MANGO_NOSCHEMA_LABEL"],
        group_analysis_unit=group_analysis_unit,
    )
    schema_files = glob.glob(get_metadata_schema_dir(g.irods_session) + "/*.json")
    # template_files = glob.glob("static/metadata-templates/*.json")
    metadata_schema_filenames = [
        base_file_name
        for template_file in schema_files
        if (base_file_name := os.path.basename(template_file)) != "uischema.json"
    ]
    schema_labels = {}
    if (
        len(grouped_metadata) == 1
        and current_app.config["MANGO_NOSCHEMA_LABEL"] in grouped_metadata
    ):
        pass
    else:
        json_template_dir = get_metadata_schema_dir(g.irods_session)

        for schema in grouped_metadata:  # schema_labels[schema][item.name]:
            if schema != current_app.config["MANGO_NOSCHEMA_LABEL"]:
                try:
                    if version := grouped_metadata[schema].get(
                        f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{schema}.__version__",
                        "",
                    ):
                        schema_dict = json.loads(
                            schema_manager.load_schema(
                                schema, status="", version=version.value
                            )
                        )
                    else:
                        schema_dict = json.loads(
                            schema_manager.load_schema(schema, status="published")
                        )

                    if schema_dict:
                        schema_labels[schema] = flatten_schema(
                            ("", schema_dict),
                            level=0,
                            prefix=f"{current_app.config['MANGO_SCHEMA_PREFIX']}.{schema}",
                            result_dict={},
                        )
                    logging.info(f"Flattened schema {schema}: {schema_labels[schema]}")
                except:
                    pass
    if group_analysis_unit:
        consolidated_analysis_metadata_names = (
            [avu_name for avu_name in grouped_metadata["analysis"]]
            if "analysis" in grouped_metadata
            else []
        )
    else:
        # consolidated_analysis_metadata_names = []
        # pprint.pprint(grouped_metadata['other'].items())
        consolidated_analysis_metadata_names = [
            avu.name
            for avu in grouped_metadata[
                current_app.config["MANGO_NOSCHEMA_LABEL"]
            ].values()
            if avu.units and avu.units.startswith("analysis")
        ]
    # see if the mime type is present in the metadata, if not
    acl_users = []

    permissions = g.irods_session.permissions.get(
        data_object, report_raw_acls=True, acl_users=acl_users
    )

    # Workaround for a bug with report_raw_acls for data objects where every ACL is listed twice
    PermissionTuple = namedtuple(
        "PermissionTuple", ["user_name", "access_name", "user_zone"]
    )
    # List and set calls is used to get unique named tuples working around the mentioned bug
    permissions = list(
        set(
            [
                PermissionTuple(p.user_name, p.access_name, p.user_zone)
                for p in permissions
            ]
        )
    )

    acl_users_dict = {user.name: user.type for user in acl_users}
    acl_counts = Counter([permission.access_name for permission in permissions])

    my_groups = g.irods_session.my_groups

    # temp: look up metadata items in full, including create_time and modify_time
    # from irods.query import Query
    # from irods.column import Criterion, In
    # from irods.models import DataObjectMeta

    # objects = [DataObjectMeta]
    # filters = []
    # avu_ids = [metadata.avu_id for metadata in meta_data_items]
    # filters += [In(DataObjectMeta.id, avu_ids)]

    # query = Query(g.irods_session, *objects).filter(*filters)
    # metadata_objects = query.execute()

    # end temp
    tika_result = {}
    tika_storage = f"storage/{g.irods_session.zone}/tika_output"
    tika_file_path = f"{tika_storage}/{data_object.id}.tika.json"

    if os.path.exists(tika_file_path) and data_object.modify_time < (
        analysis_timestamp := datetime.datetime.fromtimestamp(
            os.path.getmtime(tika_file_path)
        )
    ):
        with open(tika_file_path, mode="r") as tika_file:
            tika_result = json.load(tika_file)
            tika_result["X-ANALYSIS-timestamp"] = analysis_timestamp.replace(
                tzinfo=datetime.timezone.utc, microsecond=0
            ).isoformat()

    view_template = get_template_override_manager(
        g.irods_session.zone
    ).get_template_for_catalog_item(data_object, "common/object_view.html.j2")
    logging.info(f"Object view: using template {view_template}")
    logging.info(f"Realm: {realm}")

    return render_template(
        view_template,
        data_object=data_object,
        meta_data_items=meta_data_items,
        breadcrumbs=generate_breadcrumbs(data_object_path),
        permissions=permissions,
        acl_users_dict=acl_users_dict,
        acl_counts=acl_counts,
        my_groups=my_groups,
        grouped_metadata=grouped_metadata,
        schema_labels=schema_labels,
        realm=realm,
        schemas=schemas,
        tika_result=tika_result,
        consolidated_names=consolidated_analysis_metadata_names,
        current_user_rights=current_user_rights,
    )


# @browse_bp.route("/data-object/download/<path:data_object_path>")
# def download_object(data_object_path):
#     """
#     """
#     if not data_object_path.startswith("/"):
#         data_object_path = "/" + data_object_path
#     data_object = g.irods_session.data_objects.get(data_object_path)
#     # Abort for too large files, 20MB limit for now
#     if data_object.size > 20000000:
#         return abort(413)

#     local_path = f"/tmp/irods-download-{data_object.id}.dat"
#     with open(local_path, "wb") as local_file, data_object.open() as irods_file:
#         position = 0
#         while position < data_object.size:
#             read_bytes = min(
#                 g.irods_session.data_objects.READ_BUFFER_SIZE,
#                 data_object.size - position,
#             )
#             file_chunk = irods_file.read(read_bytes)
#             bytes_read = len(file_chunk)
#             local_file.write(file_chunk)
#             position += bytes_read

#     return send_file(
#         local_path, as_attachment=True, attachment_filename=data_object.name
#     )


@browse_bp.route("/data-object/download/<path:data_object_path>")
def download_object(data_object_path):
    """ """

    # convert url encoded characters back to their utf-8 equivalent so iRODS
    data_object_path = unquote(data_object_path)
    print(f"data object download request for {data_object_path}")

    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path

    data_object = g.irods_session.data_objects.get(data_object_path)
    # Abort for too large files, 20GB limit for now
    if data_object.size > 20000000000:
        return abort(413)
    object_name = f"{data_object.name}"
    (object_type, object_encoding) = mimetypes.guess_type(object_name)
    if object_type is None:
        object_type = "application/octet-stream"

    read_buffer_size = 2**22
    print(f"Current read buffer size is {read_buffer_size}")

    def data_object_chunks():
        with data_object.open("r") as f:
            position = 0
            start = time.time()
            while position < data_object.size:
                read_bytes = min(
                    read_buffer_size,  # 64kB #g.irods_session.data_objects.READ_BUFFER_SIZE,  # typically 8MB
                    data_object.size - position,
                )
                file_chunk = f.read(read_bytes)
                bytes_read = len(file_chunk)
                position += bytes_read
                print(
                    f"{data_object.name}: sending {position} bytes after {time.time()-start}"
                )
                yield file_chunk

    return Response(
        stream_with_context(data_object_chunks()),
        mimetype=object_type,
        direct_passthrough=True,
        headers={"Content-Disposition": "attachment"},
    )


@browse_bp.route("/collection/delete", methods=["POST", "DELETE"])
def delete_collection():
    """ """
    collection_path = request.form["collection_path"]
    if "force_delete" in request.values:
        force_delete = True
    else:
        force_delete = (
            True
            if collection_path.startswith(f"/{g.irods_session.zone}/trash")
            else False
        )
    print(
        f"Recursive and forced remove of {collection_path} based on /{g.irods_session.zone}/trash: {force_delete}"
    )
    # workaround for a problem in tier1-data
    if g.irods_session.zone == "kuleuven_tier1_pilot":
        force_delete = True
    # recursive remove
    g.irods_session.collections.remove(collection_path, force=force_delete)

    if force_delete:
        signals.collection_deleted.send(
            current_app._get_current_object(),
            irods_session=g.irods_session,
            collection_path=collection_path,
        )
        flash(f"Successfully deleted {collection_path}", "success")
    else:
        signals.collection_trashed.send(
            current_app._get_current_object(),
            irods_session=g.irods_session,
            collection_path=collection_path,
        )
        flash(f"Collection {collection_path} moved to trash", "success")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/data-object/delete", methods=["POST", "DELETE"])
def delete_data_object():
    """ """
    data_object_path = request.form["data_object_path"]
    if "force_delete" in request.values:
        force_delete = True
    else:
        force_delete = (
            True
            if data_object_path.startswith(f"/{g.irods_session.zone}/trash")
            else False
        )
    g.irods_session.data_objects.get(data_object_path).unlink(force=force_delete)

    if force_delete:
        signals.data_object_deleted.send(
            current_app._get_current_object(),
            irods_session=g.irods_session,
            data_object_path=data_object_path,
        )
        flash(f"Successfully deleted {data_object_path}", "success")
    else:
        signals.data_object_trashed.send(
            current_app._get_current_object(),
            irods_session=g.irods_session,
            data_object_path=data_object_path,
        )
        flash(f"Data object {data_object_path} moved to trash", "success")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


# Blueprint common
# @browse_bp.route("/collection/upload/file", methods=["POST"])
# def collection_upload_file():
#     """
#     """

#     collection = request.form["collection"]
#     print(f"Requested upload file for collection {collection}")
#     f = request.files["newfile"]
#     filename = "/tmp/" + f.filename
#     f.save(filename)

#     current_collection = g.irods_session.collections.get(collection)
#     irods_session.data_objects.put(filename, collection + "/" + f.filename)
#     os.unlink(filename)

# return redirect(request.referrer)


@browse_bp.route("/collection/upload/file", methods=["POST"])
def collection_upload_file():
    """ """

    collection = request.form["collection"]
    print(f"Requested upload file for collection {collection}")
    f = request.files["file"]
    filename = "/tmp/" + f.filename
    f.save(filename)

    # current_collection = irods_session.collections.get(collection)
    g.irods_session.data_objects.put(filename, collection + "/" + f.filename)
    data_object: iRODSDataObject = g.irods_session.data_objects.get(
        f"{collection}/{f.filename}"
    )

    signals.data_object_added.send(
        current_app._get_current_object(),
        irods_session=g.irods_session,
        data_object_path=data_object.path,
    )

    os.unlink(filename)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/collection/add/subcollection", methods=["POST"])
def add_collection():
    """ """
    parent_collection_path = request.form["parent_collection_path"]
    collection_name = request.form["collection_name"]
    # parent_collection = irods_session.collections.get(parent_collection_path)
    full_path = f"{parent_collection_path}/{collection_name}"
    try:
        g.irods_session.collections.get(full_path)
        flash(f"Collection {collection_name} already exists", "warning")
    except Exception as e:
        g.irods_session.collections.create(full_path)

        if "/" in collection_name:
            new_collection_tree_root = (
                f"{parent_collection_path}/{collection_name.split('/')[0]}"
            )
            signals.subtree_added.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                collection_path=new_collection_tree_root,
            )
        else:
            signals.collection_added.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                collection_path=full_path,
            )
            flash(
                f"Collection {collection_name} added to {parent_collection_path}",
                "success",
            )

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/data-object/ask_tika/<path:data_object_path>")
def ask_tika(data_object_path):
    """ """
    # impose referral:
    referral = url_for("browse_bp.view_object", data_object_path=data_object_path)
    logging.info(f"Tika referral: {referral}")

    # FETCH FROM CONFIG INSTEAD
    tika_host = current_app.config["TIKA_URL"].rstrip("/")
    tika_url = f"{tika_host}/tika/text"
    tika_storage = f"storage/{g.irods_session.zone}/tika_output"
    if not os.path.exists(tika_storage):
        os.makedirs(tika_storage)
    data_object_path = unquote(data_object_path)

    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path

    data_object = g.irods_session.data_objects.get(data_object_path)

    tika_file_path = f"{tika_storage}/{data_object.id}.tika.json"

    if (
        os.path.exists(tika_file_path)
        and data_object.modify_time
        < datetime.datetime.fromtimestamp(os.path.getmtime(tika_file_path))
        and not "skip-tika-cache" in request.values
    ):
        with open(tika_file_path, mode="r") as tika_file:
            result = json.load(tika_file)
    else:
        try:
            # ping_tika = requests.get(tika_host)
            destination = f"/tmp/irods-{data_object.id}.download"

            options = {irods.keywords.FORCE_FLAG_KW: True}
            data_object = g.irods_session.data_objects.get(
                data_object_path, destination, **options
            )

            # files = {"file": (data_object.name, open(destination, mode="rb").read())}
            headers = {
                "Accept": "application/json",
                # "Content-Type": "application/octet-stream",
                # "X-Tika-OCRLanguage": "eng+fra"
            }
            # pprint.pprint(request.values)
            if not "do-tika-ocr" in request.values:
                # "X-Tika-OCRmaxFileSizeToOcr": "0",  # Tika 1.x
                # "X-Tika-OCRskipOcr": "true", #Tika 2.x
                headers["X-Tika-OCRskipOcr"] = "true"
            try:
                res = requests.put(
                    url=tika_url, headers=headers, data=open(destination, mode="rb")
                )
                # result = res.content
                result = dict(sorted(res.json().items()))
                # pprint.pprint(result)
                # strip multiple blank lines to just one
                result["X-TIKA:content"] = re.sub("\n+", "\n", result["X-TIKA:content"])
                result["X-TIKA:content"] = result["X-TIKA:content"].strip()
                with open(tika_file_path, mode="w") as tika_file:
                    json.dump(result, fp=tika_file)
                flash(f"Data object {data_object_path} analyzed with Tika", "success")

            except Exception as e:
                result = {"error": f"Something went wrong asking Tika about me: {e}"}
                flash(f"Something went wrong asking Tika about me: {e}", "warning")

            os.unlink(destination)
        except Exception as e:
            result = {"error": f"Tika discover service is not reachable: {e}"}
            flash(f"Tika analysis service is not reachable", "warning")

    if "X-TIKA:content" in result and len(result["X-TIKA:content"]) > 50000:
        result["X-TIKA:content"] = (
            result["X-TIKA:content"][:50000] + "\n ------☢️-truncated-☢️-------\n"
        )

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(referral.split("#")[0] + request.values["redirect_hash"])
    return redirect(referral)

    # return render_template(
    #     "object_ask_tika.html.j2",
    #     data_object=data_object,
    #     breadcrumbs=generate_breadcrumbs(data_object_path),
    #     result=result,
    # )


@browse_bp.route("/data-object/preview/<path:data_object_path>")
def object_preview(data_object_path):
    """ """
    thumbnail_storage = f"storage/{g.irods_session.zone}/{__name__}/object_preview"
    if not os.path.exists(thumbnail_storage):
        os.makedirs(thumbnail_storage)
    data_object_path = unquote(data_object_path)
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

    if data_object.size == 0:
        return send_file("static/bh_sag_A.jpg", "image/jpeg")
    if data_object.size > current_app.config["DATA_OBJECT_MAX_SIZE_PREVIEW"]:
        return send_file("static/too-large.jpg", "image/jpeg")
    else:
        if not os.path.exists(f"{thumbnail_storage}/{data_object.id}.png"):
            local_path = f"/tmp/irods-download-{data_object.name}"
            with open(local_path, "wb") as local_file, data_object.open() as irods_file:
                position = 0
                while position < data_object.size:
                    read_bytes = min(
                        g.irods_session.data_objects.READ_BUFFER_SIZE,
                        data_object.size - position,
                    )
                    file_chunk = irods_file.read(read_bytes)
                    bytes_read = len(file_chunk)
                    local_file.write(file_chunk)
                    position += bytes_read

            if data_object.name.lower().endswith(("pdf")):
                with tempfile.TemporaryDirectory() as path:
                    image = convert_from_path(
                        f"/tmp/irods-download-{data_object.name}",
                        output_folder=path,
                        last_page=1,
                        fmt="png",
                        size=400,
                        single_file=True,
                    )[0]
                    image.save(f"{thumbnail_storage}/{data_object.id}.png")

            else:
                try:
                    image = Image.open(f"/tmp/irods-download-{data_object.name}")
                    image.thumbnail((400, 400))
                    image.save(f"{thumbnail_storage}/{data_object.id}.png")
                except Exception as e:
                    logging.info(f"failed generating preview for {data_object_path}")
            os.unlink(local_path)
        if os.path.exists(f"{thumbnail_storage}/{data_object.id}.png"):
            return send_file(f"{thumbnail_storage}/{data_object.id}.png", "image/png")
        else:
            return send_file("static/generate_preview_failed.png", "image/png")


@browse_bp.route("/permission/set/<path:item_path>", methods=["POST"])
def set_permissions(item_path: str):
    """ """
    groups = request.form.get("groups", [])
    permission_type = request.form.get("permission_type", "null")
    recursive = True if "recursive" in request.form else False
    if not item_path.startswith("/"):
        item_path = "/" + item_path

    try:
        if isinstance(groups, list):
            for group in groups:
                g.irods_session.permissions.set(
                    iRODSAccess(permission_type, item_path, user_name=group),
                    recursive=recursive,
                )
        else:
            g.irods_session.permissions.set(
                iRODSAccess(permission_type, item_path, user_name=groups),
                recursive=recursive,
            )
    except Exception as e:
        print(e)
        abort(500, "failed to set permissions")

    signals.permissions_changed.send(
        current_app._get_current_object(),
        irods_session=g.irods_session,
        item_path=item_path,
        recursive=recursive,
    )
    flash(f"Permissions changed for {item_path}", "success")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/permission/inheritance/set/<path:collection_path>", methods=["POST"])
def set_inheritance(collection_path: str):
    """ """
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    if "inheritance" in request.form:
        g.irods_session.permissions.set(iRODSAccess("inherit", collection_path))
    else:
        g.irods_session.permissions.set(iRODSAccess("noinherit", collection_path))

    signals.collection_changed.send(
        current_app._get_current_object(),
        irods_session=g.irods_session,
        collection_path=collection_path,
    )
    flash(f"Inheritance updated for {collection_path}", "success")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/trash/empty/user", methods=["POST"])
def empty_user_trash():
    user_trash_path = f"/{g.irods_session.zone}/trash/home/{g.irods_session.username}"
    user_trash = g.irods_session.collections.get(user_trash_path)

    for sub_collection in user_trash.subcollections:
        g.irods_session.collections.remove(sub_collection.path, force=True)
    for data_object in user_trash.data_objects:
        g.irods_session.data_objects.get(data_object.path).unlink(force=True)

    flash(f"Emptied your trash can", "success")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(url_for("browse_bp.collection_browse", collection=user_trash_path))


@browse_bp.route("/items/bulk", methods=["POST"])
@csrf.exempt
def bulk_operation_items():
    """ """

    def return_error(message):
        flash(message, category="warning")
        if "redirect_route" in request.values:
            return redirect(request.values["redirect_route"])
        if "redirect_hash" in request.values:
            return redirect(
                request.referrer.split("#")[0] + request.values["redirect_hash"]
            )
        return redirect(request.referrer)

    if not ("items" in request.form):
        return return_error("Missing selection")
    if not ("action" in request.form):
        return return_error("Don't know what you want to do!")
    if (request.form["action"] in ["move", "copy"]) and not (
        "destination" in request.form
    ):
        return_error("Destination for move or copy is missing")

    irods_session: iRODSSession = g.irods_session
    irods_session.collections

    ITEM_TYPE_PART = {"data_object": "dobj", "collection": "col"}

    success_count = 0
    failure_count = 0
    success = True

    action = request.form["action"]

    if action == "delete":
        force_delete = (
            True
            if "force_delete" in request.form and request.form["force_delete"]
            else False
        )
        for item in request.form.getlist("items"):
            match = re.match(r"(dobj|col)-(.*)", item)
            if match:
                (item_type, item_path) = (match.group(1), match.group(2))
                if item_type == ITEM_TYPE_PART["data_object"]:
                    try:
                        irods_session.data_objects.get(item_path).unlink(
                            force=force_delete
                        )

                        if force_delete:
                            signals.data_object_deleted.send(
                                current_app._get_current_object(),
                                irods_session=g.irods_session,
                                data_object_path=item_path,
                            )
                        else:
                            signals.data_object_trashed.send(
                                current_app._get_current_object(),
                                irods_session=g.irods_session,
                                data_object_path=item_path,
                            )
                        success_count += 1
                    except Exception as e:
                        success = False
                        failure_count += 1
                        flash(
                            f"Problem removing data object {item_path} : {e}", "danger"
                        )
                if item_type == ITEM_TYPE_PART["collection"]:
                    try:
                        irods_session.collections.remove(item_path, force=force_delete)
                        if force_delete:
                            signals.collection_deleted.send(
                                current_app._get_current_object(),
                                irods_session=g.irods_session,
                                collection_path=item_path,
                            )
                        else:
                            signals.collection_trashed.send(
                                current_app._get_current_object(),
                                irods_session=g.irods_session,
                                collection_path=item_path,
                            )
                        success_count += 1
                    except Exception as e:
                        success = False
                        failure_count += 1
                        flash(
                            f"Problem removing data object {item_path} : {e}", "danger"
                        )

    def get_safe_path_if_data_object_exists(path_to_check: PurePath):
        if irods_session.data_objects.exists(path_to_check.as_posix()):
            alternate_path = path_to_check.parent / (
                path_to_check.stem + "-copy" + path_to_check.suffix
            )
            logging.info(
                f"{path_to_check} already exists, renaming to {alternate_path}"
            )
            flash(
                f"{path_to_check} already exists, renaming to {alternate_path}",
                "warning",
            )
            return get_safe_path_if_data_object_exists(alternate_path)
        # logging.info(f"get safe path: {path_to_check} does not exist yet")
        return path_to_check

    if request.form["action"] == "move":
        for item in request.form.getlist("items"):
            match = re.match(r"(dobj|col)-(.*)", item)
            if match:
                (item_type, item_path) = (match.group(1), match.group(2))
                new_path = (
                    PurePath(request.form["destination"]) / PurePath(item_path).name
                )
                if new_path.as_posix() == item_path:
                    flash(
                        f"Source {item_path} is equal to destination {new_path}, not moving",
                        "warning",
                    )
                    success = False
                    failure_count += 1
                    break
                if item_type == ITEM_TYPE_PART["data_object"]:
                    try:
                        safe_path = get_safe_path_if_data_object_exists(new_path)
                        safe_path_as_string = safe_path.as_posix()
                        # logging.info(f"Moving {item_path} to {safe_path_as_string}")
                        irods_session.data_objects.move(item_path, safe_path_as_string)
                        signals.data_object_moved.send(
                            current_app._get_current_object(),
                            irods_session=g.irods_session,
                            original_path=item_path,
                            destination_path=safe_path_as_string,
                            new_path=new_path,
                        )
                        success_count += 1
                    except Exception as e:
                        success = False
                        failure_count += 1
                        flash(f"Problem moving data object {item_path} : {e}", "danger")

                if item_type == ITEM_TYPE_PART["collection"]:
                    try:
                        irods_session.collections.move(
                            item_path, request.form["destination"]
                        )
                        signals.collection_moved.send(
                            current_app._get_current_object(),
                            irods_session=g.irods_session,
                            original_path=item_path,
                            destination_path=request.form["destination"],
                            new_path=new_path,
                        )
                        success_count += 1
                    except Exception as e:
                        success = False
                        failure_count += 1
                        flash(f"Problem moving collection {item_path} : {e}", "danger")

    if request.form["action"] == "copy":
        for item in request.form.getlist("items"):
            match = re.match(r"(dobj|col)-(.*)", item)
            if match:
                (item_type, item_path) = (match.group(1), match.group(2))
                new_path = (
                    PurePath(request.form["destination"]) / PurePath(item_path).name
                )
                if item_type == ITEM_TYPE_PART["data_object"]:
                    try:
                        safe_path = get_safe_path_if_data_object_exists(new_path)
                        safe_path_as_string = safe_path.as_posix()
                        # logging.info(f"Copying {item_path} to {safe_path_as_string}")
                        irods_session.data_objects.copy(item_path, safe_path_as_string)
                        signals.data_object_copied.send(
                            current_app._get_current_object(),
                            irods_session=g.irods_session,
                            data_object_path=item_path,
                            destination_path=safe_path_as_string,
                            new_path=safe_path_as_string,
                        )
                        success_count += 1
                    except Exception as e:
                        success = False
                        failure_count += 1
                        flash(f"Problem copying {item_path} : {e}", "danger")

    OPERATION_SUCCESS_STRINGS = {
        "delete": "deleted",
        "copy": "copied",
        "move": "moved",
    }
    if success and failure_count == 0:
        flash(
            f"Successfully {OPERATION_SUCCESS_STRINGS[action]} {success_count} items",
            "success",
        )
    elif success_count > 0 and failure_count > 0:
        flash(
            f"Partial success ({success_count}), but also failures ({failure_count}) encountered in {action} operation",
            "warning",
        )
    else:
        flash(f"Failed all items ({failure_count}) for {action} operation", "danger")

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@browse_bp.route("/item/rename", methods=["POST"])
def rename_item():
    if "item_path" not in request.form or "new_name" not in request.form:
        abort(400, "Required parameters are missing")

    new_name = request.form["new_name"]
    if re.search(r"/", new_name):
        abort(400, f"Illegal characters in new name {new_name}")

    item_path = iRODSPath(request.form["item_path"])
    new_path = iRODSPath(*item_path.split("/")[:-1], new_name)
    irods_session: iRODSSession = g.irods_session

    redirect_route = request.referrer

    if item_path == new_path:
        flash("The name has not changed", "danger")
    else:
        if irods_session.collections.exists(item_path):
            irods_session.collections.move(item_path, new_path)
            signals.collection_renamed.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                original_path=item_path,
                new_path=new_path,
            )
            redirect_route = url_for("browse_bp.collection_browse", collection=new_path)
            flash("Renamed collection successfully", "success")

        elif irods_session.data_objects.exists(item_path):
            irods_session.data_objects.move(item_path, new_path)
            signals.data_object_renamed.send(
                current_app._get_current_object(),
                irods_session=g.irods_session,
                original_path=item_path,
                new_path=new_path,
            )
            redirect_route = url_for("browse_bp.view_object", data_object_path=new_path)
            flash("Renamed data object successfully", "success")
        else:
            flash("{item_path} does not exist", "danger")

    return redirect(redirect_route)


@browse_bp.route(
    "/api/collection/subcollections",
    methods=["GET"],
    defaults={"collection": None},
    strict_slashes=False,
)
@browse_bp.route("/api/collection/subcollections/<path:collection>")
def get_sub_collections(collection):
    if collection is None or collection == "~":
        collection = g.zone_home
    if not collection.startswith("/"):
        collection = "/" + collection
    current_collection = g.irods_session.collections.get(collection)
    d = {"path": current_collection.path, "name": current_collection.name}
    d["children"] = [
        {"path": collection.path, "name": collection.name}
        for collection in current_collection.subcollections
    ]
    return flask.jsonify(d)
