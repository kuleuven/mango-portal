import os
from cachelib import FileSystemCache
import uuid

MANGO_AUTH = os.environ.get("MANGO_AUTH", "login")  # "localdev" or "login"
MANGO_LOGIN_ACTION = "mango_portal.kernel.user.user_bp.login_basic"
MANGO_LOGOUT_ACTION = "mango_portal.kernel.user.user_bp.logout_basic"
SECRET_KEY = os.environ.get("SECRET_KEY", str(uuid.uuid4()))
DATA_OBJECT_MAX_SIZE_PREVIEW = 1024 * 1024 * 128  # 128MiB
DATA_OBJECT_MAX_SIZE_DOWNLOAD = 1024 * 1024 * 1024 * 50  # 50GiB
DATA_OBJECT_PREVIEW_ALLOWED_SUFFIXES = (
    "jpg",
    "jpeg",
    "png",
    "pdf",
    "tif",
    "tiff",
    "gif",
)
CACHE_TYPE = "FileSystemCache"
CACHE_DEFAULT_TIMEOUT = 300
CACHE_DIR = "storage/cache"
DEBUG = os.environ.get("DEBUG", False)
LOGGING_LEVEL = "INFO"  # 'DEBUG'
ACL_PROTECT_OWN = True
MANGO_PREFIX = "mg"
MANGO_SCHEMA_PREFIX = "mgs"
MANGO_ALL_PREFIXES = (MANGO_PREFIX, MANGO_SCHEMA_PREFIX)
MANGO_NOSCHEMA_LABEL = "other"
PREFIX_DOTTED_LIST = [prefix + "." for prefix in MANGO_ALL_PREFIXES] + ["irods::"]
METADATA_NOEDIT_PREFIX = tuple(PREFIX_DOTTED_LIST)

TIKA_URL = os.environ.get("TIKA_URL", "http://localhost:9998/")
USER_MAX_HOME_SIZE = 100 * 10**6  # 100MB
# MANGO_GLOBAL_SEARCH_ACTION = "mango_open_search_bp.zone_search"
HOSTNAME = os.environ.get("HOSTNAME", "unnamed-host")


# All the kernel modules and plugins are supposted to expose an init_app function that takes the Flask app 
# as argument and registers the routes and other functionality of the module/plugin with the app. 
# The init_app function is called during app initialization in mango_portal/__init__.py
MANGO_PORTAL_KERNEL = [
    "mango_portal.kernel.metadata_schema",
    "mango_portal.kernel.common",
    "mango_portal.kernel.metadata",
    "mango_portal.kernel.search",
    "mango_portal.kernel.user",
    "mango_portal.kernel.template_overrides",
]

MANGO_PORTAL_PLUGINS = [
    "mango_portal.plugins.user_tantra",
    "mango_portal.plugins.admin",
    "mango_portal.plugins.mango_overrides",
    "mango_portal.plugins.basic_user_group_manager",
]

MANGO_NON_LOGGED_IN_ROUTES = [
    "static",
    "user_bp.login_basic",
]

MANGO_ADMINS = [
    "rods"
]

MANGO_MAIN_LANDING_ROUTE = {"module": "mango_portal.plugins.user_tantra.realm", "function": "index"}
MANGO_SCHEMA_PERMISSIONS_MANAGER_CLASS = {
    "module": "mango_portal.kernel.metadata_schema.base",
    "class": "GroupBasedSchemaPermissions",
}

MANGO_SCHEMA_MANAGER_CLASS = {
    "module": "mango_portal.kernel.metadata_schema.base",
    "class": "iRODSSchemaManager",
}

MANGO_ERROR_MESSAGES = {
    "-370000": "You are not allowed to perform this action.",
    "missing_paramenters": "Required parameters are missing",
    "illegal_characters": "Illegal characters have been used: request rejected.",
}

### Session backend, this refers to the Flask sessions, not iRODSSession

SESSION_TYPE = "cachelib"
SESSION_PERMANENT = True  # default True
SESSION_SERIALIZATION_FORMAT = "json"  # defaults to 'msgpack'
SESSION_CACHELIB = FileSystemCache(threshold=100000, cache_dir="/tmp/sessions")
PERMANENT_SESSION_LIFETIME = 1 * 24 * 60 * 60  # 1 days
SESSION_KEY_PREFIX = "mango_portal_session:"
