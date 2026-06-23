import os

from irods.session import iRODSSession


# @todo: move to mango-lib
def get_irods_session_from_environment():
    irods_env_file = os.getenv(
        "IRODS_ENV_FILE", os.path.expanduser("~/.irods/irods_environment.json")
    )
    return iRODSSession(irods_env_file=irods_env_file)
