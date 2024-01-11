import os

MANGO_AUTH = os.environ.get("MANGO_AUTH", "login")  # "localdev" or "login"
MANGO_LOGIN_ACTION = "data_platform_user_bp.login_openid"
MANGO_LOGOUT_ACTION = "data_platform_user_bp.logout_openid"
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
MANGO_GLOBAL_SEARCH_ACTION = "mango_open_search_bp.zone_search"
HOSTNAME = os.environ.get("HOSTNAME", "unnamed-host")

   

MANGO_PLUGIN_BLUEPRINTS = [
    # {"module": "", "blueprint": ""},
    {"module": "plugins.mango_open_search.search", "blueprint": "mango_open_search_bp"},
    {"module": "plugins.mango_open_search.admin", "blueprint": "mango_open_search_admin_bp"},
    {"module": "plugins.mango_open_search.api", "blueprint": "mango_open_search_api_bp"},
    {"module": "plugins.mango_open_search.stats", "blueprint": "mango_open_search_stats_bp"},
    {"module": "plugins.data_platform.user", "blueprint": "data_platform_user_bp"},
    {"module": "plugins.data_platform.project", "blueprint": "data_platform_project_bp"},
    {"module": "plugins.data_platform.autocomplete", "blueprint": "data_platform_autocomplete_bp"},
    {"module": "plugins.operator_group_manager.admin", "blueprint": "operator_group_manager_admin_bp"},
    {"module": "plugins.operator.admin", "blueprint": "operator_admin_bp"},
    {"module": "plugins.admin.admin", "blueprint": "admin_admin_bp"},
    {"module": "plugins.template_overrides.admin", "blueprint": "template_overrides_admin_bp"},
    {"module": "plugins.user_tantra.realm", "blueprint": "user_tantra_realm_bp"},
    {"module": "plugins.mango_overrides", "blueprint": "mango_overrides_bp"},
]


MANGO_ADMINS = [
    "u0123318",
    "u0118974",
    "u0116999",
    "u0137480",
    "u0089722",
    "u0079275",
    "u0056780",
    "u0031305",
]

MANGO_MAIN_LANDING_ROUTE = {"module": "plugins.user_tantra.realm", "function": "index"}
MANGO_SCHEMA_PERMISSIONS_MANAGER_CLASS = {"module": "plugins.mango_overrides.schema_permissions", "class": "GroupBasedSchemaPermissions"}
