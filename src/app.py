import logging
import os

# get the root logger and set the level to INFO to catch any start up info messages
rootlogger = logging.getLogger()
rootlogger.setLevel("INFO")

from irods.session import iRODSSession
from irods.manager.metadata_manager import iRODSMeta
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
# Early initialisation to avoid circulr imports from main app and its config by other modules
app = Flask(__name__)
app.config.from_pyfile(os.getenv("MANGO_CONFIG","config.py"))
# global dict holding the irods sessions per user, identified either by their flask session id or by a magic key 'localdev'

irods_sessions = {}

from cache import cache
import flask
from pprint import pformat
from flask_cors import CORS
import json
import irods
import pytz
import bleach
import humanize
import re
import base64
import binascii
import importlib

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
from kernel.metadata_schema.editor import metadata_schema_editor_bp
from kernel.metadata_schema.form import metadata_schema_form_bp
from kernel.template_overrides import template_overrides_bp
import platform
import version


irods_zone_config_module = importlib.import_module(os.getenv('IRODS_ZONES_CONFIG', 'irods_zones_config.py').rstrip('.py'))

import irods_session_pool
from werkzeug.exceptions import HTTPException

import datetime


print(f"Flask version {flask.__version__}")
app.config["irods_zones"] = irods_zone_config_module.irods_zones


# set the loggin level to the configured one
rootlogger.setLevel(app.config.get("LOGGING_LEVEL", "INFO"))


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

# Caching, make sure the filesystem dir existsif CACHE_TYPE  is FileSystemCache 
if app.config["CACHE_TYPE"] == "FileSystemCache" and not os.path.exists(app.config["CACHE_DIR"]):
    os.makedirs(app.config["CACHE_DIR"])

cache.init_app(app)
with app.app_context():
    cache.clear()

# Add debug toolbar
if os.getenv("FLASK_DEBUG_TOOLBAR", "disabled").lower() == "enabled":
    from flask_debugtoolbar import DebugToolbarExtension

    toolbar = DebugToolbarExtension(app)




# Register core blueprints
with app.app_context():
    app.register_blueprint(user_bp)
    app.register_blueprint(error_bp)
    app.register_blueprint(browse_bp)
    app.register_blueprint(metadata_bp)
    app.register_blueprint(basic_search_bp)
    app.register_blueprint(metadata_schema_editor_bp)
    app.register_blueprint(metadata_schema_form_bp)
    app.register_blueprint(template_overrides_bp)
    


# import plugin blueprints dynamically based on the configuration

for mango_plugin_bp in app.config.get('MANGO_PLUGIN_BLUEPRINTS', []):
    module = importlib.import_module(mango_plugin_bp["module"])
    app.register_blueprint(getattr(module, mango_plugin_bp["blueprint"]))

if app.config.get('DEBUG', False):
    print(app.url_map)

from mango_ui import admin_navbar_entries, navbar_entries


@app.context_processor
def ui_navbars():
    return {
        "admin_navbar_entries": admin_navbar_entries,
        "navbar_entries": navbar_entries,
    }


for blueprint in admin_navbar_entries:
    logging.info(f"Admin UI: added {blueprint}")


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
        "data_platform_project_bp.add_rdr_project",
        "data_platform_project_bp.modify_project",
        "data_platform_autocomplete_bp.autocomplete_username",
        "data_platform_user_bp.local_client_retrieve_token_callback",
        "data_platform_project_bp.project_overview",
        "data_platform_project_bp.set_project_options",
        "data_platform_project_bp.projects_statistics",
        "data_platform_project_bp.projects_usage",
        "data_platform_project_bp.project_user_search",
        "data_platform_project_bp.rule_management",
        "data_platform_project_bp.project_quota_change",
        "operator_admin_bp.reset_all",
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
                parameters = irods_zone_config_module.DEFAULT_IRODS_PARAMETERS.copy()
                ssl_settings = irods_zone_config_module.DEFAULT_SSL_PARAMETERS.copy()
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
    if type(suspect) == str:
        return bleach.clean(suspect, **kwargs)
    else:
        return suspect


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


@app.template_filter("format_epoch_timestamp")
def format_epoch_timestamp(ets):
    return datetime.datetime.fromtimestamp(ets)


@app.template_filter("regex_search")
def regex_search(_string, _re):
    return re.search(_re, _string)


@app.template_filter("regex_match")
def regex_match(_string, _re):
    return re.match(_re, _string)


@app.template_filter("irods_to_sha256_checksum")
def irods_to_sha256_checksum(irods_checksum):
    if irods_checksum is None or not irods_checksum.startswith("sha2:"):
        return None

    return binascii.hexlify(base64.b64decode(irods_checksum[5:])).decode("utf-8")

@app.template_filter("get_one_irods_metadata")
def get_one_irods_metadata(irods_object, meta_name):
    try:
        avu = irods_object.metadata.get_one(meta_name)
        return avu
    except Exception as e:
        return iRODSMeta(meta_name, '')

# register the main landing page route dynamically
main_landing_route = app.config.get(
    "MANGO_MAIN_LANDING_ROUTE", {"module": "kernel.common.browse", "function": "index"}
)

main_landing_route_module = importlib.import_module(
    main_landing_route["module"], package="app"
)

app.add_url_rule(
    "/", view_func=getattr(main_landing_route_module, main_landing_route["function"])
)

