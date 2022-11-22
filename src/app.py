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
    session,
    current_app,
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

# Blueprints
from user.user import user_bp
from common.error import error_bp
from common.browse import browse_bp
from metadata.metadata import metadata_bp
from search.basic_search import basic_search_bp
from metadata_schema.editor import metadata_schema_editor_bp
from metadata_schema.form import metadata_schema_form_bp
from admin.admin import admin_bp

from irods.session import iRODSSession
import platform
from irods_zones_config import irods_zones, DEFAULT_IRODS_PARAMETERS, DEFAULT_SSL_PARAMETERS
import irods_session_pool
from werkzeug.exceptions import HTTPException
import logging
import datetime

#from flask_debugtoolbar import DebugToolbarExtension

print(f"Flask version {flask.__version__}")

app = Flask(__name__)


app.config.from_pyfile('config.py')
app.config['irods_zones'] = irods_zones

# global dict holding the irods sessions per user, identified either by their flask session id or by a magic key 'localdev'
irods_sessions = {}
## Allow cross origin requests for SPA/Ajax situations
CORS(app)

# get the root logger and set the
rootlogger = logging.getLogger()
rootlogger.setLevel(app.config.get('LOGGING_LEVEL', 'INFO'))

mango_server_info = {'server_start': datetime.datetime.now()}
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

# Add debug toolbar
#toolbar = DebugToolbarExtension(app)


# Register blueprints
with app.app_context():
    app.register_blueprint(user_bp)
    app.register_blueprint(error_bp)
    app.register_blueprint(browse_bp)
    app.register_blueprint(metadata_bp)
    app.register_blueprint(basic_search_bp)
    app.register_blueprint(metadata_schema_editor_bp)
    app.register_blueprint(metadata_schema_form_bp)
    app.register_blueprint(admin_bp)


@app.context_processor
def dump_variable():
    return dict(pformat=pformat)

@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.exception(e)
    # pass through HTTP errors
    if isinstance(e, HTTPException):
        return e

    # non-HTTP exceptions only
    return render_template("500.html.j2", e=e), 500

@app.before_request
def init_and_secure_views():
    """
    """

    if request.endpoint in ['static','user_bp.login_basic', 'user_bp.login_zone', 'user_bp.login_via_go_callback']:
        return None

    # some globals for feeding the templates
    g.prc_version = irods.__version__
    g.flask_version = flask.__version__
    g.python_version = platform.python_version()

    #check sessions cleanup daemon and spawn a new one if needed
    irods_session_pool.check_and_restart_cleanup()

    if current_app.config["MANGO_AUTH"] == 'localdev':
        irods_session = None
        if not 'userid' in session:
            print(f"No user id in session")
        if 'userid' in session:
            irods_session = irods_session_pool.get_irods_session(session['userid'])
        if not irods_session:
            print("No irods session found in pool, recreating one")
            irods_env_file = os.path.expanduser("~/.irods/irods_environment.json")
            irods_session = iRODSSession(irods_env_file=irods_env_file)
            session['userid'] = irods_session.username
            irods_session_pool.add_irods_session(session['userid'], irods_session)
        g.irods_session = irods_session
        print(f"Session id: {session['userid']}")
        user_home = f"/{g.irods_session.zone}/home/{irods_session.username}"
        zone_home = f"/{g.irods_session.zone}/home"

        return None

    if current_app.config["MANGO_AUTH"] in ['basic', 'via_callback']:
        irods_session = None
        if not 'userid' in session:
            print(f"No user id in session, basic auth")
        if 'userid' in session:
            irods_session = irods_session_pool.get_irods_session(session['userid'])
        if not irods_session and 'password' in session and 'zone' in session:
            #try to recreate a session object,maybe the password is still valid
            try:
                parameters = DEFAULT_IRODS_PARAMETERS.copy()
                ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
                zone=session['zone']
                parameters.update(irods_zones[zone]['parameters'])
                ssl_settings.update(irods_zones[zone]['ssl_settings'])
                irods_session = iRODSSession(
                    user=session['userid'],
                    password=session['password'],
                    **parameters,
                    **ssl_settings
                )
                irods_session.collections.get(f"/{irods_session.zone}/home")
                irods_session_pool.add_irods_session(session['userid'], irods_session)
            except:
                irods_session = None
                #note we'll leave the session['zone'] parameter for use a hint in the login form
                session.pop('userid', default=None)
                session.pop('password', default=None)


        if irods_session:
            g.irods_session = irods_session
            user_home = f"/{g.irods_session.zone}/home/{irods_session.username}"
            zone_home = f"/{g.irods_session.zone}/home"
            g.user_home = user_home
            g.zone_home = zone_home
            g.mango_server_info = mango_server_info
            return None
        else:
            if current_app.config["MANGO_AUTH"] == 'basic':
                return redirect(url_for('user_bp.login_basic'))
            if current_app.config["MANGO_AUTH"] == 'via_callback':
                return redirect(url_for('user_bp.login_zone'))

@app.after_request
def release_irods_session_lock(response):
    if 'userid' in session:
        irods_session_pool.unlock_irods_session(session['userid'])
    return response

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

@app.route("/")
def index():
    return render_template(
        "index.html.j2",
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
        collection = g.user_home
    if not collection.startswith("/"):
        collection = "/" + collection
    current_collection = irods_session.collections.get(collection)
    return flask.jsonify([collection_tree_to_dict(current_collection)])


@app.route("/test", methods=["GET"])
def test_simple_vue():
    """
    """
    return render_template("test.html.j2")
