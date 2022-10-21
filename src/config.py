import os

MANGO_AUTH='basic' # 'localdev', 'basic', 'pam'
UPLOAD_FOLDER = "/tmp"
SECRET_KEY = os.environ.get('SECRET_KEY','HV44H6oH-eKMqJDU0W6Xw6ch_c4wpmDWf5tgD0p-0Gc')
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
TIKA_URL = os.environ.get('TIKA_URL', 'http://localhost:9998/')
USER_MAX_HOME_SIZE=100*10**6 #100MB