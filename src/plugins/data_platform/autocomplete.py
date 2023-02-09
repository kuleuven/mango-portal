import requests
from flask import (
    Blueprint,
    jsonify
)

from . import openid_login_required

data_platform_autocomplete_bp = Blueprint(
    "data_platform_autocomplete_bp", __name__, template_folder="templates"
)

@openid_login_required
@data_platform_autocomplete_bp.route("/data-platform/autocomplete/username/<term>", methods=["GET"])
def autocomplete_username(term):
    return jsonify([
        {
            'username': 'u0079275',
            'label': 'Peter Verraedt',
        },
        {
            'username': 'vsc31987',
            'label': 'Peter Verraedt',
        }
    ])