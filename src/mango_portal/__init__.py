import datetime
import importlib
import logging
import os
import platform


def get_app(
    config_module_name: str | None = None,
    root_path: str | os.PathLike[str] | None = None,
    template_folder: str | os.PathLike[str] | None = None,
    static_folder: str | os.PathLike[str] | None = None,
):
    """Returns the Flask application instance, optionally loading a specific configuration module."""

    import flask
    import irods
    from flask import (
        Flask,
        current_app,
        g,
        redirect,
        render_template,
        request,
        session,
        url_for,
    )
    from flask_bootstrap import Bootstrap5
    from flask_cors import CORS
    from flask_session import Session
    from mango_lib.jinja import MangoJinjaExtension
    from werkzeug.exceptions import HTTPException, ServiceUnavailable

    import mango_portal.irods_session_pool as irods_session_pool
    import mango_portal.version as version

    from .cache import cache
    from .csrf import csrf
    from .kernel.user import get_irods_session_from_environment

    rootlogger = logging.getLogger()
    rootlogger.setLevel("INFO")

    app = Flask(
        __name__,
        root_path=root_path,
        template_folder=template_folder,
        static_folder=static_folder,
    )

    irods_zone_config_module = importlib.import_module(
        os.getenv("IRODS_ZONES_CONFIG", "mango_portal.irods_zones_config")
    )
    app.config["irods_zones"] = irods_zone_config_module.irods_zones

    # Initialize Jinja extensions
    app.jinja_env.add_extension(MangoJinjaExtension)

    # 1) Load packaged defaults first (always)
    import mango_portal.default_config as _default_config

    app.config.from_object(_default_config)

    # 2) Then overlay the application config, if available

    try:
        if config_module_name:
            _app_config_module = importlib.import_module(config_module_name)
        else:
            import config as _app_config_module
        app.config.from_object(_app_config_module)
        app.logger.info(f"Loaded application config from {_app_config_module.__file__}")
    except Exception as e:
        app.logger.warning(f"Failed to load application config: {e}")

    # initialize kernel modules
    for kernel_module in app.config.get("MANGO_PORTAL_KERNEL", []):
        try:
            kernel_module = importlib.import_module(kernel_module)
            if hasattr(kernel_module, "init_app"):
                kernel_module.init_app(app)
                app.logger.info(f"Initialized kernel module {kernel_module.__name__}")
            else:
                app.logger.warning(
                    f"Kernel module {kernel_module.__name__} does not have an init_app function"
                )
        except Exception as e:
            app.logger.error(f"Failed to initialize kernel module {kernel_module}: {e}")

    # Initialize plugins
    for plugin_module in app.config.get("MANGO_PORTAL_PLUGINS", []):
        # try:
        plugin_module = importlib.import_module(plugin_module)
        if hasattr(plugin_module, "init_app"):
            plugin_module.init_app(app)
            app.logger.info(f"Initialized plugin module {plugin_module.__name__}")
        else:
            app.logger.warning(
                f"Plugin module {plugin_module.__name__} does not have an init_app function"
            )
        # except Exception as e:
        #     app.logger.error(f"Failed to initialize plugin module {plugin_module}: {e}")

    # global dict holding the irods sessions per user, identified either by their flask session id or by a magic key 'localdev'

    # use a non default session handler only if specified
    if app.config.get("SESSION_TYPE", None):
        Session(app)  # use session specified in config.py

    print(f"Flask version {flask.__version__}")

    # set the loggin level to the configured one
    rootlogger.setLevel(app.config.get("LOGGING_LEVEL", "INFO"))

    # Allow cross origin requests for SPA/Ajax situations
    CORS(app, supports_credentials=True)

    mango_server_info = {"server_start": datetime.datetime.now()}
    # app.config["EXPLAIN_TEMPLATE_LOADING"] = True
    ## enable auto escape in jinja2 templates
    app.jinja_options["autoescape"] = lambda _: True

    # register bootstrap5 support
    bootstrap = Bootstrap5(app)
    # register csrf on the main app
    csrf.init_app(app)

    # Caching, make sure the filesystem dir existsif CACHE_TYPE  is FileSystemCache
    if app.config["CACHE_TYPE"] == "FileSystemCache" and not os.path.exists(
        app.config["CACHE_DIR"]
    ):
        os.makedirs(app.config["CACHE_DIR"])

    cache.init_app(app)
    with app.app_context():
        cache.clear()

    # Add debug toolbar if enabled via environment variable
    if os.getenv("FLASK_DEBUG_TOOLBAR", "disabled").lower() == "enabled":
        from flask_debugtoolbar import DebugToolbarExtension

        DebugToolbarExtension(app)

    if _mod_func := os.getenv(
        "LOCALDEV_SESSION_FUNC"
    ):  # in "module[.submodule].function" format
        _mod, _func = _mod_func.rsplit(".", 1)
        localdev_session_func = getattr(importlib.import_module(_mod), _func)
    else:
        localdev_session_func = get_irods_session_from_environment

    @app.context_processor
    def ui_navbars():
        from .mango_ui import admin_navbar_entries, navbar_entries

        for blueprint in admin_navbar_entries:
            logging.info(f"Admin UI: added {blueprint}")

        for blueprint in navbar_entries:
            logging.info(f"UI: added {blueprint}")

        return {
            "admin_navbar_entries": admin_navbar_entries,
            "navbar_entries": navbar_entries,
        }

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
        # Always let static resources be served, eg css, js , images
        if request.endpoint in app.config["MANGO_NON_LOGGED_IN_ROUTES"]:
            return None

        # First check if there are no calamities and need to interrupt here
        if os.path.isfile("storage/service-down.txt"):
            message = ""
            with open("storage/service-down.txt") as f:
                message = f.read()
            raise ServiceUnavailable(message)

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
                irods_session = localdev_session_func()
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

            if irods_session:
                g.irods_session = irods_session
                user_home = f"/{g.irods_session.zone}/home/{irods_session.username}"
                zone_home = f"/{g.irods_session.zone}/home"
                g.user_home = user_home
                g.zone_home = zone_home
                g.mango_server_info = mango_server_info
                return None
            else:
                # save the request url which may come from a bookmark or a page that was iopen longer than the irods session lifetime
                session["redirect_after_login"] = (
                    request.url
                )  # this is with a http scheme, but gets rewritten as https
                print(f"Request url before login {request.url}")
                return redirect(url_for(current_app.config["MANGO_LOGIN_ACTION"]))

    @app.after_request
    def release_irods_session_lock(response):
        if "userid" in session:
            irods_session_pool.unlock_irods_session(session["userid"])
        return response

    # register the main landing page route dynamically
    main_landing_route = app.config.get(
        "MANGO_MAIN_LANDING_ROUTE",
        {"module": "kernel.common.browse", "function": "index"},
    )

    main_landing_route_module = importlib.import_module(
        main_landing_route["module"], package="app"
    )

    app.add_url_rule(
        "/",
        endpoint="index",
        view_func=getattr(main_landing_route_module, main_landing_route["function"]),
    )

    return app
