import os

MANGO_AUTH = os.environ.get(
    "MANGO_AUTH", "openid"
)  # "localdev", "basic", "openid", "via_callback"
UPLOAD_FOLDER = "/tmp"
SECRET_KEY = os.environ.get("SECRET_KEY", "HV44H6oH-eKMqJDU0W6Xw6ch_c4wpmDWf5tgD0p-0Gc")
DATA_OBJECT_MAX_SIZE_PREVIEW = 1024 * 1024 * 16  # 16MB
CACHE_TYPE = "SimpleCache"
CACHE_DEFAULT_TIMEOUT = 300
CACHE_DIR = "storage/cache"
DEBUG = True
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
MANGO_ENABLE_CORE_PLUGINS = ["mango_open_search"]
