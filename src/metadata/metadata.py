from pprint import pprint
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
    current_app
)
from irods import models, query, session
from irods.meta import iRODSMeta, AVUOperation
import json
import lib.util
import signals

metadata_bp = Blueprint("metadata_bp", __name__, template_folder="templates/metadata")


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
    signals.collection_changed.send(current_app._get_current_object(), irods_session = g.irods_session, collection_path=collection_path)

    flash(f"Successfully added metadata to {collection.name}", "success")
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
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

    signals.collection_changed.send(current_app._get_current_object(), irods_session = g.irods_session, collection_path=collection_path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
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

    signals.collection_changed.send(current_app._get_current_object(), irods_session = g.irods_session, collection_path=collection_path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
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

    signals.data_object_changed.send(current_app._get_current_object(), irods_session = g.irods_session, data_object_path=data_object_path)

    flash(f"Successfully added metadata to {data_object.name}", "success")
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
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

    signals.data_object_changed.send(current_app._get_current_object(), irods_session = g.irods_session, data_object_path=data_object_path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
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

    signals.data_object_changed.send(current_app._get_current_object(), irods_session = g.irods_session, data_object_path=data_object_path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)


@metadata_bp.route("/data_object/metadata/add_tika_results", methods=["POST"])
def add_tika_metadata():
    """
    """
    data_object_path = request.form["data_object_path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = g.irods_session.data_objects.get(data_object_path)

    # pprint(request.form.getlist("consolidate"))
    avu_operation_list = []
    for av_string in request.form.getlist("consolidate"):
        av_dict = json.loads(av_string)
        av_key = list(av_dict.keys())[0]
        av_value = av_dict[av_key]
        avu_operation_list.append(
            AVUOperation(
                operation="add", avu=iRODSMeta(av_key, av_value, "analysis/tika")
            )
        )
    #data_object.metadata.apply_atomic_operations(*avu_operation_list)
    # workaround for a bug in 4.2.11
    lib.util.execute_atomic_operations(g.irods_session, data_object, avu_operation_list)

    signals.data_object_changed.send(current_app._get_current_object(), irods_session = g.irods_session, data_object_path=data_object_path)

    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)
