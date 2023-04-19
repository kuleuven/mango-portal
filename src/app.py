import logging

# get the root logger and set the level to INFO to catch any start up info messages
rootlogger = logging.getLogger()
rootlogger.setLevel("INFO")

from irods.session import iRODSSession
from flask import (
    Flask,
    g,
    redirect,
    request,
    url_for,
    render_template,
    Blueprint,
    session,
    current_app,
)
from cache import cache
import os
import flask
from pprint import pformat
from flask_cors import CORS
import json
import irods
import pytz
import bleach
import humanize

# proxy so it can also be imported in blueprints from csrf.py independently
from csrf import csrf

from flask_bootstrap import Bootstrap5
from lib.util import collection_tree_to_dict
from pprint import pprint

# Blueprints
from kernel.user.user import user_bp
from kernel.common.error import error_bp
from kernel.common.browse import browse_bp
from kernel.metadata.metadata import metadata_bp
from kernel.search.basic_search import basic_search_bp
from kernel.admin.admin import admin_bp
from kernel.metadata_schema.editor import metadata_schema_editor_bp
from kernel.metadata_schema.form import metadata_schema_form_bp
from kernel.template_overrides.admin import template_overrides_admin_bp
import platform
import importlib
import version


from irods_zones_config import (
    irods_zones,
    DEFAULT_IRODS_PARAMETERS,
    DEFAULT_SSL_PARAMETERS,
)
import irods_session_pool
from werkzeug.exceptions import HTTPException

import datetime


print(f"Flask version {flask.__version__}")

app = Flask(__name__)


app.config.from_pyfile("config.py")
app.config["irods_zones"] = irods_zones

# set the loggin level to the configured one
rootlogger.setLevel(app.config.get("LOGGING_LEVEL", "INFO"))

if "mango_open_search" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
    from plugins.mango_open_search.search import mango_open_search_bp
    from plugins.mango_open_search.admin import mango_open_search_admin_bp
    from plugins.mango_open_search.api import mango_open_search_api_bp

if "data_platform" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
    from plugins.data_platform import update_zone_info

    # if not app.config["MANGO_AUTH"] == "localdev":
    update_zone_info(app.config["irods_zones"])

    from plugins.data_platform.user import data_platform_user_bp
    from plugins.data_platform.project import data_platform_project_bp
    from plugins.data_platform.autocomplete import data_platform_autocomplete_bp

other_plugins = [
    plugin
    for plugin in app.config["MANGO_ENABLE_CORE_PLUGINS"]
    if plugin not in ["mango_open_search", "data_platform"]
]
if "operator_group_manager" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
    from plugins.operator_group_manager.admin import operator_group_manager_admin_bp
if "operator" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
    from plugins.operator.admin import operator_admin_bp

# global dict holding the irods sessions per user, identified either by their flask session id or by a magic key 'localdev'
irods_sessions = {}
## Allow cross origin requests for SPA/Ajax situations
CORS(app)


mango_server_info = {"server_start": datetime.datetime.now()}
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
if os.getenv("FLASK_DEBUG_TOOLBAR", "disabled").lower() == "enabled":
    from flask_debugtoolbar import DebugToolbarExtension

    toolbar = DebugToolbarExtension(app)


# Register blueprints
with app.app_context():
    app.register_blueprint(user_bp)
    app.register_blueprint(error_bp)
    app.register_blueprint(browse_bp)
    app.register_blueprint(metadata_bp)
    app.register_blueprint(basic_search_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(metadata_schema_editor_bp)
    app.register_blueprint(metadata_schema_form_bp)
    app.register_blueprint(template_overrides_admin_bp)

    if "mango_open_search" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
        app.register_blueprint(mango_open_search_bp)
        app.register_blueprint(mango_open_search_admin_bp)
        app.register_blueprint(mango_open_search_api_bp)

    if "data_platform" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
        app.register_blueprint(data_platform_user_bp)
        app.register_blueprint(data_platform_project_bp)
        app.register_blueprint(data_platform_autocomplete_bp)

    if "operator" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
        app.register_blueprint(operator_admin_bp)
    if "operator_group_manager" in app.config["MANGO_ENABLE_CORE_PLUGINS"]:
        app.register_blueprint(operator_group_manager_admin_bp)


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
    """ """

    if request.endpoint in [
        "static",
        "user_bp.login_basic",
        "data_platform_user_bp.login_openid",
        "data_platform_user_bp.login_openid_callback",
        "data_platform_user_bp.login_openid_select_zone",
        "data_platform_user_bp.logout_openid",
        "data_platform_user_bp.connection_info_modal",
        "data_platform_user_bp.drop_permissions",
        "data_platform_user_bp.impersonate",
        "data_platform_project_bp.project",
        "data_platform_project_bp.add_project_member",
        "data_platform_project_bp.delete_project_member",
        "data_platform_project_bp.deploy_project",
        "data_platform_project_bp.api_token",
        "data_platform_project_bp.add_irods_project",
        "data_platform_project_bp.add_generic_project",
        "data_platform_project_bp.modify_project",
        "data_platform_autocomplete_bp.autocomplete_username",
        "data_platform_user_bp.local_client_retrieve_token_callback",
        "data_platform_project_bp.project_overview",
    ]:
        return None

    # some globals for feeding the templates
    g.prc_version = irods.__version__
    g.flask_version = flask.__version__
    g.python_version = platform.python_version()
    g.mango_version = version.__version__

    # check sessions cleanup daemon and spawn a new one if needed
    irods_session_pool.check_and_restart_cleanup()

    if current_app.config["MANGO_AUTH"] == "localdev":
        irods_session = None
        if not "userid" in session:
            print(f"No user id in session")
        if "userid" in session:
            irods_session = irods_session_pool.get_irods_session(session["userid"])
        if not irods_session:
            print("No irods session found in pool, recreating one")
            irods_env_file = os.path.expanduser("~/.irods/irods_environment.json")
            irods_session = iRODSSession(irods_env_file=irods_env_file)
            session["userid"] = irods_session.username
            irods_session_pool.add_irods_session(session["userid"], irods_session)
        g.irods_session = irods_session
        print(f"Session id: {session['userid']}")
        g.user_home = f"/{g.irods_session.zone}/home/{irods_session.username}"
        g.zone_home = f"/{g.irods_session.zone}/home"

        g.mango_server_info = mango_server_info

        return None

    else:
        irods_session = None
        if not "userid" in session:
            print(f"No user id in session, need auth")
        if "userid" in session:
            irods_session = irods_session_pool.get_irods_session(session["userid"])
        if not irods_session and "password" in session and "zone" in session:
            # try to recreate a session object,maybe the password is still valid
            try:
                parameters = DEFAULT_IRODS_PARAMETERS.copy()
                ssl_settings = DEFAULT_SSL_PARAMETERS.copy()
                zone = session["zone"]
                parameters.update(app.config["irods_zones"][zone]["parameters"])
                ssl_settings.update(app.config["irods_zones"][zone]["ssl_settings"])
                irods_session = iRODSSession(
                    user=session["userid"],
                    password=session["password"],
                    **parameters,
                    **ssl_settings,
                )
                irods_session.collections.get(f"/{irods_session.zone}/home")
                irods_session_pool.add_irods_session(session["userid"], irods_session)
            except:
                irods_session = None
                # note we'll leave the session['zone'] parameter for use a hint in the login form
                session.pop("userid", default=None)
                session.pop("password", default=None)

        if irods_session:
            g.irods_session = irods_session
            user_home = f"/{g.irods_session.zone}/home/{irods_session.username}"
            zone_home = f"/{g.irods_session.zone}/home"
            g.user_home = user_home
            g.zone_home = zone_home
            g.mango_server_info = mango_server_info
            return None
        else:
            return redirect(url_for(current_app.config["MANGO_LOGIN_ACTION"]))


@app.after_request
def release_irods_session_lock(response):
    if "userid" in session:
        irods_session_pool.unlock_irods_session(session["userid"])
    return response


# custom filters

# intersection of 2 iterables
@app.template_filter("intersection")
def intersection(set1, set2):
    return set(set1).intersection(set(set2))


# html and js escape dangerous content
@app.template_filter("bleach_clean")
def bleach_clean(suspect, **kwargs):
    return bleach.clean(suspect, **kwargs)


# return date into local time zone
@app.template_filter("localize_datetime")
def localize_datetime(
    value, format="%Y-%m-%d %H:%M:%S", local_timezone="Europe/Brussels"
):
    tz = pytz.timezone(local_timezone)  # timezone you want to convert to from UTC
    utc = pytz.timezone("UTC")
    value = utc.localize(value, is_dst=None).astimezone(pytz.utc)
    local_dt = value.astimezone(tz)
    return local_dt.strftime(format)


@app.template_filter("parse_json_date")
def parse_json_date(ts):
    return datetime.datetime.strptime(ts, "%Y-%m-%d")


@app.template_filter("parse_json_timestamp")
def parse_json_timestamp(ts):
    return datetime.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S%z")


@app.template_filter("format_date")
def format_date(ts):
    return ts.strftime("%Y-%m-%d")


@app.template_filter("format_timestamp")
def format_timestamp(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


@app.template_filter("yesterday")
def yesterday(ts):
    return ts - datetime.timedelta(days=1)


@app.template_filter("format_time")
def format_time(ts, format="%Y-%m-%dT%H:%M:%S"):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


@app.template_filter("format_size")
def format_size(size):
    return humanize.naturalsize(size)


@app.template_filter("format_intword")
def format_intword(size):
    return humanize.intword(size)


@app.template_filter("pprint_as_json")
def pprint_as_json(anything, indent=2):
    return json.dumps(anything, indent=indent)


@app.template_filter("python_type")
def python_type(anything):
    return type(anything)


@app.template_filter("format_datetime_iso")
def format_datetime(datetime_object):
    return datetime.datetime.strftime(datetime_object, "%Y-%m-%dT%H:%M:%S")


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
    if collection is None or collection == "~":
        collection = g.zone_home
    if not collection.startswith("/"):
        collection = "/" + collection
    current_collection = g.irods_session.collections.get(collection)

    @cache.cached(
        timeout=50,
        key_prefix=f"{g.irods_session.username}-{g.irods_session.zone}-{request.path}",
    )
    def json_tree(collection):
        return flask.jsonify([collection_tree_to_dict(current_collection)])

    return json_tree(current_collection)


@app.route("/test", methods=["GET"])
def test_simple_vue():
    return render_template("test.html.j2")
