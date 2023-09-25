# This configuration is meant for a vanilla iRODS installation and should work out of the box
# provided either 
import os

MANGO_AUTH = os.environ.get("MANGO_AUTH", "login")  # "localdev" or "login"
MANGO_LOGIN_ACTION = "user_bp.login_basic"
MANGO_LOGOUT_ACTION = "user_bp.logout_basic"
UPLOAD_FOLDER = "/tmp"
SECRET_KEY = os.environ.get("SECRET_KEY", "HV44H6oH-eKMqJDU0W6Xw6ch_c4wpmDWf5tgD0p-0Gc")
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
CACHE_TYPE = "SimpleCache"
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

MANGO_OVERRIDE_TEMPLATE_RULES_CONFIG = "config/template_override_rules_basic.yml"

MANGO_ADMINS = [] # list of usernames that would be considered ManGO portal admins

MANGO_PLUGIN_BLUEPRINTS = [] # 

# MANGO_MAIN_LANDING_ROUTE = {"module": "plugins.user_tantra.realm", "function": "index"}
# MANGO_SCHEMA_PERMISSIONS_MANAGER_CLASS = {"module": "plugins.mango_overrides.schema_permissions", "class": "GroupBasedSchemaPermissions"}
