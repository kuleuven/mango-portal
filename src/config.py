# not much yet
MANGO_AUTH='basic' # 'localdev', 'basic', 'pam'
UPLOAD_FOLDER = "/tmp"
SECRET_KEY = "mushrooms_from_paris"
DATA_OBJECT_MAX_SIZE_PREVIEW = 1024 * 1024 * 16
CACHE_TYPE = "SimpleCache"
CACHE_DEFAULT_TIMEOUT = 300
CACHE_DIR = "storage/cache"
DEBUG = True
ACL_PROTECT_OWN = True
MANGO_PREFIX = "mg"
MANGO_NOSCHEMA_LABEL = "other"
METADATA_NOEDIT_PREFIX = (
    f"{MANGO_PREFIX}.",
    "irods::",
)
