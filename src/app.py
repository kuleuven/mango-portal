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
    Blueprint,
)
from cache import cache
import os
import glob
import flask
import sys
from pprint import pformat
from flask_cors import CORS
import json
import irods

from flask_wtf import CSRFProtect

# proxy so it can also be imported in blueprints from csrf.py independently
from csrf import csrf

from jinja2 import Environment, select_autoescape
from flask_bootstrap import Bootstrap5
from lib.util import collection_tree_to_dict
from pprint import pprint
from operator import itemgetter

from user.user import user_bp
from common.error import error_bp
from common.browse import browse_bp
from metadata.metadata import metadata_bp
from search.basic_search import basic_search_bp
from metadata_schema.editor import metadata_schema_editor_bp
from metadata_schema.form import metadata_schema_form_bp

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
import platform

# from werkzeug import secure_filename

# from vsc_irods.manager import path_manager, search_manager, bulk_manager

irods_env_file = os.path.expanduser("~/.irods/irods_environment.json")
irods_zone = "kuleuven_tier1_pilot"

print(f"Flask version {flask.__version__}")

irods_session = iRODSSession(irods_env_file=irods_env_file)
success = False
user_home = f"/{irods_session.zone}/home/{irods_session.username}"
zone_home = f"/{irods_session.zone}/home"
if irods_session.collections.exists(user_home):
    success = True
    print(f"Success", file=sys.stderr)


app = Flask(__name__)


## Allow cross origin requests for SPA/Ajax situations
CORS(app)


app.config["UPLOAD_FOLDER"] = "/tmp"
app.config["MAX_CONTENT_PATH"] = 1024 * 1024 * 16
app.config["SECRET_KEY"] = "mushrooms_from_paris"
app.config["DATA_OBJECT_MAX_SIZE_PREVIEW"] = 1024 * 1024 * 16
app.config["CACHE_TYPE"] = "FileSystemCache"
app.config["CACHE_DEFAULT_TIMEOUT"] = 300
app.config["CACHE_DIR"] = "storage/cache"
app.config["DEBUG"] = True
# app.config["EXPLAIN_TEMPLATE_LOADING"] = True
## enable auto escape in jinja2 templates
app.jinja_options["autoescape"] = lambda _: True

# register bootstrap5 support
bootstrap = Bootstrap5(app)
# register csrf on the main app
csrf.init_app(app)

# Caching, make sure the filesystem dir exists
if not os.path.exists(app.config["CACHE_DIR"]):
    os.makedirs(app.config["CACHE_DIR"])

cache.init_app(app)
with app.app_context():
    cache.clear()

# Register blueprints
with app.app_context():
    app.register_blueprint(user_bp)
    app.register_blueprint(error_bp)
    app.register_blueprint(browse_bp)
    app.register_blueprint(metadata_bp)
    app.register_blueprint(basic_search_bp)
    app.register_blueprint(metadata_schema_editor_bp)
    app.register_blueprint(metadata_schema_form_bp)


@app.context_processor
def dump_variable():
    return dict(pformat=pformat)


# permissions
# irods_session.permissions.get


@app.before_request
def init_irods():
    """
    """
    global irods_session
    g.irods_session = irods_session
    g.user_home = user_home
    g.zone_home = zone_home
    g.prc_version = irods.__version__
    g.flask_version = flask.__version__
    g.python_version = platform.python_version()


# custom filters


@app.template_filter("format_timestamp")
def format_timestamp(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


@app.template_filter("format_time")
def format_time(ts, format="%Y-%m-%dT%H:%M:%S"):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


# Move to lib or util
def collection_tree_to_dict(collection):
    (_, label) = os.path.split(collection.path)
    d = {"id": collection.path, "label": label}
    if collection.subcollections:
        d["children"] = [
            collection_tree_to_dict(subcollection)
            for subcollection in collection.subcollections
        ]
    return d


# app.jinja_options["variable_start_string"] = "@{"

# Blueprint common
@app.route("/")
def index():
    collection = irods_session.collections.get(user_home)
    collections = collection.subcollections
    data_objects = collection.data_objects
    # print(
    #     f"Success, in zone {irods_session.zone} collections { collections } and objects { data_objects }",
    #     file=sys.stderr,
    # )
    # app.logger.info(irods_session.__dict__)
    # to_query = (
    #     Query(g.irods_session, DataObject.id)
    #     .filter(Criterion("=", DataObject.replica_number, 0))
    #     .count(DataObject.id)
    # )
    # total_objects_result = to_query.execute()
    # total_objects = int(total_objects_result[0][DataObject.id])
    # for r in total_objects_result:
    #     pprint(r)
    # avu_query = Query(g.irods_session, (DataObjectMeta.id)).count(DataObjectMeta.id)

    # total_avu_result = avu_query.execute()
    # total_avu = int(total_avu_result[0][DataObjectMeta.id])

    # avu_groups_query = Query(g.irods_session, (DataObjectMeta.name)).count(
    #     DataObjectMeta.value
    # )
    # avu_groups_result = avu_groups_query.execute()

    # avu_counts = []

    # for r in avu_groups_result:
    #     # pprint(r)
    #     avu_counts.append(
    #         {"name": r[DataObjectMeta.name], "total": int(r[DataObjectMeta.value])}
    #     )

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
        # total_objects=total_objects,
        # total_avu=total_avu,
        # avu_counts=sorted(avu_counts, key=itemgetter("total"), reverse=True),
    )


# Testing endpoint
@app.route("/metadata-template/dump-form-contents", methods=["POST"])
@csrf.exempt
def dump_meta_data_form():
    """
    dumps all variables defined url encoded from the request body, for example
    variable1=value1&variable2=value2
    """

    # log output
    print(f"{json.dumps(request.form)}")

    return json.dumps(request.form)


# Testing endpoint
@app.route("/metadata-template/dump-contents-body/<filename>", methods=["POST"])
@csrf.exempt
def dump_meta_data_body_json(filename):
    """
    expects "Content-Type: application/json" header
    """
    print(f"{filename}")
    print(f"{request.data}")

    return "OK"


# Blueprint api
# Endpoint for obtaining collection trees
@app.route(
    "/api/collection/tree",
    methods=["GET"],
    defaults={"collection": None},
    strict_slashes=False,
)
@app.route("/api/collection/tree/<path:collection>")
def api_collection_tree(collection):
    """
    """
    if collection is None or collection == "~":
        collection = user_home
    if not collection.startswith("/"):
        collection = "/" + collection
    current_collection = irods_session.collections.get(collection)
    return flask.jsonify([collection_tree_to_dict(current_collection)])


@app.route("/test", methods=["GET"])
def test_simple_vue():
    """
    """
    return render_template("test.html.j2")
