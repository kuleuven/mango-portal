from flask import (
    Blueprint,
    request,
    render_template,
    url_for,
    redirect,
    g,
    send_file,
    abort,
    flash,
)
from irods import models, query, session

metadata_bp = Blueprint("metadata_bp", __name__, template_folder="templates/metadata")


@metadata_bp.route("/metadata/search")
def metadata_basic_search():
    """
    """


@metadata_bp.route("/collection/add/metadata", methods=["POST"])
def add_meta_data_collection():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    collection_path = request.form["collection-path"]
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    collection = g.irods_session.collections.get(collection_path)
    collection.metadata.add(avu_name, avu_value, avu_units)
    # print(avu_name, avu_value, avu_units, collection_path, sep="|")

    flash(f"Successfully added metadata to {collection.name}", "success")
    return redirect(request.referrer)


@metadata_bp.route("/collection/metadata/edit", methods=["POST"])
def edit_meta_data_collection():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    orig_avu_name = request.form["orig-meta-data-name"]
    orig_avu_value = request.form["orig-meta-data-value"]
    orig_avu_units = request.form["orig-meta-data-units"]
    collection_path = request.form["collection-path"]
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    collection = g.irods_session.collections.get(collection_path)
    collection.metadata.remove(orig_avu_name, orig_avu_value, orig_avu_units)
    collection.metadata.add(avu_name, avu_value, avu_units)

    return redirect(request.referrer)


# Blueprint common/metadata
@metadata_bp.route("/collection/metadata/delete", methods=["POST"])
def delete_meta_data_collection():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    collection_path = request.form["collection-path"]
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    collection = g.irods_session.collections.get(collection_path)
    collection.metadata.remove(avu_name, avu_value, avu_units)

    return redirect(request.referrer)


@metadata_bp.route("/data_object/metadata/add", methods=["POST"])
def add_meta_data():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    data_object_path = request.form["object-path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)
    data_object.metadata.add(avu_name, avu_value, avu_units)
    # print(avu_name, avu_value, avu_units, data_object_path, sep="|")

    flash(f"Successfully added metadata to {data_object.name}", "success")
    return redirect(request.referrer)


@metadata_bp.route("/data_object/metadata/edit", methods=["POST"])
def edit_meta_data():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    orig_avu_name = request.form["orig-meta-data-name"]
    orig_avu_value = request.form["orig-meta-data-value"]
    orig_avu_units = request.form["orig-meta-data-units"]
    data_object_path = request.form["object-path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)
    data_object.metadata.remove(orig_avu_name, orig_avu_value, orig_avu_units)
    data_object.metadata.add(avu_name, avu_value, avu_units)

    return redirect(request.referrer)


@metadata_bp.route("/data_object/metadata/delete", methods=["POST"])
def delete_meta_data():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    data_object_path = request.form["object-path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)
    data_object.metadata.remove(avu_name, avu_value, avu_units)

    return redirect(request.referrer)