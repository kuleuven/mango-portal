from irods.meta import iRODSMetaCollection, iRODSMeta
from irods.session import iRODSSession
from flask import (
    Flask,
    g,
    redirect,
    request,
    url_for,
    render_template,
    flash,
    make_response,
)
import os
import glob
import flask
import sys
from pprint import pformat

import json

# from werkzeug import secure_filename

# from vsc_irods.manager import path_manager, search_manager, bulk_manager

irods_env_file = os.path.expanduser("~/.irods/irods_environment.json")
irods_zone = "kuleuven_tier1_pilot"

print(f"Flask version {flask.__version__}")

irods_session = iRODSSession(irods_env_file=irods_env_file, zone=irods_zone)
success = False
user_home = f"/{irods_session.zone}/home/{irods_session.username}"
if irods_session.collections.exists(user_home):
    success = True
    print(f"Success", file=sys.stderr)

app = Flask(__name__)

app.config["UPLOAD_FOLDER"] = "/tmp"
app.config["MAX_CONTENT_PATH"] = 1024 * 1024 * 16
app.config["SECRET_KEY"] = "development_paul"

# custom filters


@app.template_filter("format_timestamp")
def format_timestamp(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


@app.template_filter("format_time")
def format_time(ts, format="%Y-%m-%dT%H:%M:%S"):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


# app.jinja_options["variable_start_string"] = "@{"


@app.route("/")
def index():
    collection = irods_session.collections.get(user_home)
    collections = collection.subcollections
    data_objects = collection.data_objects
    print(
        f"Success, in zone {irods_zone} collections { collections } and objects { data_objects }",
        file=sys.stderr,
    )
    print(irods_session.__dict__)
    # return f"Result: {collections} collections and  {data_objects} data objects"
    return render_template(
        "index.html.j2",
        irodssession=irods_session,
        current_path=user_home.split("/"),
        zone=irods_zone,
        collections=collections,
        data_objects=data_objects,
        session=irods_session,
        pformat=pformat,
        dir=dir,
        jinja_options=app.jinja_options,
        user=irods_session.username,
    )


@app.route("/browse", defaults={"collection": None}, strict_slashes=False)
@app.route("/browse/<path:collection>")
def browse(collection):
    """ returns the list of objects and subcollections for the given
    collection.

    Arguments:

    collection: str or None
        a path string
        If None,the current user home dir will be used
        if the collection path starts with a ~ character, the remaining is appended to the user home directory

    """
    if collection is None or collection == "~":
        co_path = user_home
    else:
        co_path_elements = collection.split("/")
        prefix = "/"  # default
        if co_path_elements[0] == "~":
            prefix = user_home + "/"
            co_path_elements = co_path_elements.pop(0)
        co_path = prefix + "/".join(co_path_elements)

    breadcrumbs = []
    path_elements = co_path.strip("/").split("/")
    for idx, path_element in enumerate(path_elements):
        breadcrumbs.append(
            {"label": path_element, "url": "/".join(path_elements[: idx + 1])}
        )
    # print(breadcrumbs)

    current_collection = irods_session.collections.get(co_path)
    sub_collections = current_collection.subcollections
    data_objects = current_collection.data_objects

    return render_template(
        "browse.html.j2",
        co_path=co_path,
        breadcrumbs=breadcrumbs,
        collection=current_collection,
        irodssession=irods_session,
        current_path=user_home.split("/"),
        zone=irods_zone,
        sub_collections=sub_collections,
        data_objects=data_objects,
        session=irods_session,
        username=irods_session.username,
    )


@app.route("/view/<path:data_object_path>")
def view_object(data_object_path):
    """
    """
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = irods_session.data_objects.get(data_object_path)

    meta_data_items = data_object.metadata.items()

    breadcrumbs = []
    path_elements = data_object_path.strip("/").split("/")
    for idx, path_element in enumerate(path_elements):
        breadcrumbs.append(
            {"label": path_element, "url": "/".join(path_elements[: idx + 1])}
        )

    return render_template(
        "view_object.html.j2",
        data_object=data_object,
        meta_data_items=meta_data_items,
        breadcrumbs=breadcrumbs,
    )


@app.route("/upload/file", methods=["POST"])
def upload_file():
    """
    """

    collection = request.form["collection"]
    print(f"Requested upload file for collection {collection}")
    f = request.files["newfile"]
    filename = "/tmp/" + f.filename
    f.save(filename)

    current_collection = irods_session.collections.get(collection)
    irods_session.data_objects.put(filename, collection + "/" + f.filename)
    os.unlink(filename)

    return redirect(request.referrer)


@app.route("/data_object/metadata/add", methods=["POST"])
def add_meta_data():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    data_object_path = request.form["object-path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = irods_session.data_objects.get(data_object_path)
    data_object.metadata.add(avu_name, avu_value, avu_units)
    # print(avu_name, avu_value, avu_units, data_object_path, sep="|")

    flash(f"Successfully added metadata to {data_object.name}", "success")
    return redirect(request.referrer)


@app.route("/data_object/metadata/edit", methods=["POST"])
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
    data_object = irods_session.data_objects.get(data_object_path)
    data_object.metadata.remove(orig_avu_name, orig_avu_value, orig_avu_units)
    data_object.metadata.add(avu_name, avu_value, avu_units)

    return redirect(request.referrer)


@app.route("/data_object/metadata/delete", methods=["POST"])
def delete_meta_data():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    data_object_path = request.form["object-path"]
    if not data_object_path.startswith("/"):
        data_object_path = "/" + data_object_path
    data_object = irods_session.data_objects.get(data_object_path)
    data_object.metadata.remove(avu_name, avu_value, avu_units)

    return redirect(request.referrer)


@app.route("/collection/add/subcollection", methods=["POST"])
def add_collection():
    """
    """
    parent_collection_path = request.form["parent_collection_path"]
    collection_name = request.form["collection_name"]
    # parent_collection = irods_session.collections.get(parent_collection_path)
    irods_session.collections.create(f"{parent_collection_path}/{collection_name}")

    return redirect(request.referrer)


@app.route("/collection/add/metadata", methods=["POST"])
def add_meta_data_collection():
    """
    """
    avu_name = request.form["meta-data-name"]
    avu_value = request.form["meta-data-value"]
    avu_units = request.form["meta-data-units"]
    collection_path = request.form["collection-path"]
    if not collection_path.startswith("/"):
        collection_path = "/" + collection_path
    collection = irods_session.collections.get(collection_path)
    collection.metadata.add(avu_name, avu_value, avu_units)
    # print(avu_name, avu_value, avu_units, collection_path, sep="|")

    flash(f"Successfully added metadata to {collection.name}", "success")
    return redirect(request.referrer)


##### Templates, @todo: move to blueprint

json_template_dir = os.path.abspath("./static/metadata-templates")


@app.route("/metadata-template/list", methods=["GET"])
def list_meta_data_templates():
    """
    """
    # template_files = glob.glob(json_template_dir + "/*.json")
    template_files = glob.glob("static/metadata-templates/*.json")
    template_filenames = [
        os.path.basename(template_file) for template_file in template_files
    ]

    return json.dumps(
        [
            {
                "name": name,
                "url": url_for("static", filename="metadata-templates/" + name),
            }
            for name in template_filenames
        ]
    )


"""
Single get not needed for now, static resources
@app.route("/metadata-template/get", methods=["GET"])
def get_meta_data_template():
    return redirect(request.referrer)
"""


@app.route("/metadata-template/update", methods=["POST"])
def update_meta_data_templates():
    """
    """
    return redirect(request.referrer)


@app.route("/metadata-template/new", methods=["POST"])
def new_meta_data_template():
    """
    """
    return redirect(request.referrer)


@app.route("/metadata-template/delete", methods=["POST"])
def delete_meta_data_template():
    """
    """
    return redirect(request.referrer)


@app.route("/metadata-template/dump-form", methods=["POST"])
def dump_meta_data_form():
    """
    """
    return redirect(request.referrer)
