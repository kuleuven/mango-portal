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

from PIL import Image
from pdf2image import convert_from_path
import mimetypes
import tempfile
from urllib.parse import unquote

from lib.util import generate_breadcrumbs
import magic
import os

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

    current_collection = g.irods_session.collections.get(co_path)
    sub_collections = current_collection.subcollections
    data_objects = current_collection.data_objects

    return render_template(
        "browse.html.j2",
        co_path=co_path,
        breadcrumbs=generate_breadcrumbs(co_path),
        collection=current_collection,
        sub_collections=sub_collections,
        data_objects=data_objects,
        permissions=g.irods_session.permissions.get(current_collection),
    )


@browse_bp.route("/data-object/view/<path:data_object_path>")
def view_object(data_object_path):
    """
    """
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

    meta_data_items = data_object.metadata.items()
    # see if the mime type is present in the metadata, if not
    if "p.mime" not in [item.name for item in meta_data_items]:
        try:
            with data_object.open("r") as f:
                blub = f.read(50 * 1024)
            mime_type = magic.from_buffer(blub, mime=True)
            mime_avu = iRODSMeta("p.mime", mime_type)
            data_object.metadata.add("p.mime", mime_type)
            meta_data_items.append(mime_avu)
            print(
                f"mime-type was not set for object {data_object.id}, so we blubbed a bit into magic"
            )
        except:
            flash(
                f"An error occurred with reading from {data_object_path}, mime type missing but could not be determined",
                "warning",
            )

    return render_template(
        "view_object.html.j2",
        data_object=data_object,
        meta_data_items=meta_data_items,
        breadcrumbs=generate_breadcrumbs(data_object_path),
        permissions=g.irods_session.permissions.get(data_object),
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
    return redirect(request.referrer)


@browse_bp.route("/data-object/delete", methods=["POST", "DELETE"])
def remove_data_object():
    """
    """
    data_object_path = request.form["data_object_path"]
    g.irods_session.data_objects.get(data_object_path).unlink()
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


@browse_bp.route("/data-object/preview/<path:data_object_path>")
def object_preview(data_object_path):
    """
    """
    thumbnail_storage = f"storage/thumbnails/{g.irods_session.zone}"
    if not os.path.exists(thumbnail_storage):
        os.makedirs(thumbnail_storage)
    data_object_path = unquote(data_object_path)
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

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
        if os.path.exists(f"{thumbnail_storage}/{data_object.id}.png"):
            return send_file(f"{thumbnail_storage}/{data_object.id}.png", "image/png")
        else:
            return send_file("static/too-large.jpg", "image/jpeg")
