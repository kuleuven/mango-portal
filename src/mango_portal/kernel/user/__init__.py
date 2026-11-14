import os
from flask import Flask
from irods.session import iRODSSession


# @todo: move to mango-lib
def get_irods_session_from_environment():
    irods_env_file = os.getenv(
        "IRODS_ENV_FILE", os.path.expanduser("~/.irods/irods_environment.json")
    )
    return iRODSSession(irods_env_file=irods_env_file)


def init_app(app: Flask):
    """Initialize the user kernel extension."""
    from .user import user_bp
    app.register_blueprint(user_bp)