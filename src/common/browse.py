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
from irods.user import iRODSUserGroup, UserGroup, User

from PIL import Image
from pdf2image import convert_from_path
import mimetypes
import tempfile
from urllib.parse import unquote

from lib.util import generate_breadcrumbs, flatten_josse_schema
import magic
import os
import glob
import json
import requests
import pprint
import tempfile
import re
import datetime
from collections import Counter, namedtuple

browse_bp = Blueprint("browse_bp", __name__, template_folder="templates/common")


@browse_bp.route(
    "/collection/browse", defaults={"collection": None}, strict_slashes=False
)
@browse_bp.route("/collection/browse/<path:collection>")
def collection_browse(collection):
    """ returns the list of objects and subcollections for the given
    collection.

    Arguments:

    collection: str or None
        a path string
        If None,the current user home dir will be used
        if the collection path starts with a ~ character, the remaining is appended to the user home directory

    """
    if collection is None or collection == "~":
        co_path = g.user_home
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
        abort(404)
    sub_collections = current_collection.subcollections
    data_objects = current_collection.data_objects

    schema_files = glob.glob("static/metadata-templates/*.json")
    metadata_schema_filenames = [os.path.basename(_file) for _file in schema_files]

    # metadata grouping  to be moved to proper function for re-use
    other = "other"
    grouped_metadata = {other: {}}
    for item in current_collection.metadata.items():
        """
        """
        if item.name.startswith("ku.") and item.name.count(".") >= 2:
            (ku_prefix, schema, meta_name) = item.name.split(".", 2)
            # item.name = meta_name
            if schema not in grouped_metadata:
                grouped_metadata[schema] = {}
            grouped_metadata[schema][item.name] = item

        else:
            grouped_metadata[other][item.name] = item

    schema_labels = {}
    if len(grouped_metadata) == 1 and "other" in grouped_metadata:
        pass
    else:
        json_template_dir = os.path.abspath("static/metadata-templates")
        with open(f"{json_template_dir}/{schema}.json") as template_file:
            form_dict = json.load(template_file)
            for schema in grouped_metadata:  # schema_labels[schema][item.name]:
                if schema != "other":
                    try:
                        with open(
                            f"{json_template_dir}/{schema}.json", "r"
                        ) as schema_file:
                            form_dict = json.load(schema_file)
                            schema_labels[schema] = flatten_josse_schema(
                                ("", form_dict),
                                level=0,
                                prefix=f"ku.{schema}",
                                result_dict={},
                            )
                    except (e):
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
    acl_users_dict = {user.name: user.type for user in acl_users}
    acl_counts = Counter([permission.access_name for permission in permissions])

    my_groups = [
        iRODSUserGroup(g.irods_session.user_groups, item)
        for item in g.irods_session.query(UserGroup)
        .filter(User.name == g.irods_session.username)
        .all()
    ]

    return render_template(
        "browse.html.j2",
        co_path=co_path,
        breadcrumbs=generate_breadcrumbs(co_path),
        collection=current_collection,
        sub_collections=sub_collections,
        data_objects=data_objects,
        permissions=permissions,
        acl_users=acl_users,
        acl_users_dict=acl_users_dict,
        acl_counts=acl_counts,
        metadata_schema_filenames=metadata_schema_filenames,
        grouped_metadata=grouped_metadata,  # sorted_metadata,
        schema_labels=schema_labels,
        my_groups=my_groups,
    )


@browse_bp.route("/data-object/view/<path:data_object_path>")
def view_object(data_object_path):
    """
    """
    MIME_TYPE_ATTRIBUTE_NAME = "ku.mime_type"
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

    meta_data_items = data_object.metadata.items()
    # see if the mime type is present in the metadata, if not
    if MIME_TYPE_ATTRIBUTE_NAME not in [item.name for item in meta_data_items]:
        try:
            with data_object.open("r") as f:
                blub = f.read(50 * 1024)
            mime_type = magic.from_buffer(blub, mime=True)
            mime_avu = iRODSMeta(MIME_TYPE_ATTRIBUTE_NAME, mime_type)
            data_object.metadata.add(MIME_TYPE_ATTRIBUTE_NAME, mime_type)
            meta_data_items.append(mime_avu)
            print(
                f"mime-type was not set for object {data_object.id}, so we blubbed a bit into magic"
            )
        except:
            flash(
                f"An error occurred with reading from {data_object_path}, mime type missing but could not be determined",
                "warning",
            )
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

    return render_template(
        "view_object.html.j2",
        data_object=data_object,
        meta_data_items=meta_data_items,
        breadcrumbs=generate_breadcrumbs(data_object_path),
        permissions=permissions,
        acl_users_dict=acl_users_dict,
        acl_counts=acl_counts,
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
    """
    """

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
    print(
        f"Current read buffer size is {g.irods_session.data_objects.READ_BUFFER_SIZE}"
    )

    def data_object_chunks():
        with data_object.open("r") as f:
            position = 0
            while position < data_object.size:
                read_bytes = min(
                    g.irods_session.data_objects.READ_BUFFER_SIZE,  # typically 8MB
                    data_object.size - position,
                )
                file_chunk = f.read(read_bytes)
                bytes_read = len(file_chunk)
                position += bytes_read
                yield file_chunk

    return Response(
        stream_with_context(data_object_chunks()),
        mimetype=object_type,
        direct_passthrough=True,
    )


@browse_bp.route("/collection/delete", methods=["POST", "DELETE"])
def delete_collection():
    """
    """
    collection_path = request.form["collection_path"]
    # recursive remove
    g.irods_session.collections.remove(collection_path)
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    else:
        return redirect(request.referrer)


@browse_bp.route("/data-object/delete", methods=["POST", "DELETE"])
def remove_data_object():
    """
    """
    data_object_path = request.form["data_object_path"]
    g.irods_session.data_objects.get(data_object_path).unlink()
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    else:
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
    """
    """

    collection = request.form["collection"]
    print(f"Requested upload file for collection {collection}")
    f = request.files["newfile"]
    filename = "/tmp/" + f.filename
    f.save(filename)

    # current_collection = irods_session.collections.get(collection)
    g.irods_session.data_objects.put(filename, collection + "/" + f.filename)
    data_object = g.irods_session.data_objects.get(f"{collection}/{f.filename}")

    os.unlink(filename)

    return redirect(request.referrer)


@browse_bp.route("/collection/add/subcollection", methods=["POST"])
def add_collection():
    """
    """
    parent_collection_path = request.form["parent_collection_path"]
    collection_name = request.form["collection_name"]
    # parent_collection = irods_session.collections.get(parent_collection_path)
    g.irods_session.collections.create(f"{parent_collection_path}/{collection_name}")

    return redirect(request.referrer)


@browse_bp.route("/data-object/ask_tika/<path:data_object_path>")
def ask_tika(data_object_path):
    """
    """
    # FETCH FROM CONFIG INSTEAD
    tika_host = "http://localhost:9998"
    tika_url = f"{tika_host}/tika/text"
    tika_storage = f"storage/tika_output/{g.irods_session.zone}"
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
            ping_tika = requests.get(tika_host)
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
            pprint.pprint(request.values)
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
                pprint.pprint(result)
                # strip multiple blank lines to just one
                result["X-TIKA:content"] = re.sub("\n+", "\n", result["X-TIKA:content"])
                result["X-TIKA:content"] = result["X-TIKA:content"].strip()
                with open(tika_file_path, mode="w") as tika_file:
                    json.dump(result, fp=tika_file)

            except Exception as e:
                result = {"error": f"Something went wrong asking Tika about me: {e}"}

            os.unlink(destination)
        except Exception as e:
            result = {"error": f"Tika discover service is not reachable: {e}"}

    if "X-TIKA:content" in result and len(result["X-TIKA:content"]) > 50000:
        result["X-TIKA:content"] = (
            result["X-TIKA:content"][:50000] + "\n ------☢️-truncated-☢️-------\n"
        )

    return render_template(
        "object_ask_tika.html.j2",
        data_object=data_object,
        breadcrumbs=generate_breadcrumbs(data_object_path),
        result=result,
    )


@browse_bp.route("/data-object/preview/<path:data_object_path>")
def object_preview(data_object_path):
    """
    """
    thumbnail_storage = f"storage/{__name__}/{g.irods_session.zone}/object_preview"
    if not os.path.exists(thumbnail_storage):
        os.makedirs(thumbnail_storage)
    data_object_path = unquote(data_object_path)
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

    if data_object.size == 0:
        return send_file("static/bh_sag_A.jpg", "image/jpeg")
    if (
        data_object.size > 10000000
    ):  # current_app.config('DATA_OBJECT_MAX_SIZE_PREVIEW'):
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

            if data_object.name.endswith(("pdf")):
                with tempfile.TemporaryDirectory() as path:
                    image = convert_from_path(
                        f"/tmp/irods-download-{data_object.name}",
                        output_folder=path,
                        last_page=1,
                        fmt="png",
                        size=400,
                        single_file=True,
                    )[0]

            else:
                image = Image.open(f"/tmp/irods-download-{data_object.name}")
                image.thumbnail((400, 400))
            image.save(f"{thumbnail_storage}/{data_object.id}.png")
            os.unlink(local_path)
        if os.path.exists(f"{thumbnail_storage}/{data_object.id}.png"):
            return send_file(f"{thumbnail_storage}/{data_object.id}.png", "image/png")
        else:
            return send_file("static/too-large.jpg", "image/jpeg")


@browse_bp.route("/permission/set/<path:item_path>", methods=["POST"])
def set_permissions(item_path: str):
    """
    """
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

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    else:
        return redirect(request.referrer)


@browse_bp.route("/permission/inheritance/set/<path:collection_path>", methods=["POST"])
def set_inheritance(collection_path: str):
    """
    """
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    if "inheritance" in request.form:
        g.irods_session.permissions.set(iRODSAccess("inherit", collection_path))
    else:
        g.irods_session.permissions.set(iRODSAccess("noinherit", collection_path))

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    else:
        return redirect(request.referrer)
