import requests
from flask import (
    Blueprint,
    jsonify,
    session,
    g
)

from . import openid_login_required, API_URL

data_platform_autocomplete_bp = Blueprint(
    "data_platform_autocomplete_bp", __name__, template_folder="templates"
)

@data_platform_autocomplete_bp.route("/data-platform/autocomplete/username/<term>", methods=["GET"])
@openid_login_required
def autocomplete_username(term):
    params = [('term', t) for t in term.split(' ')]

    response = requests.post(
        f"{API_URL}/v2/{g.dpa.tenant}/users/search", headers=g.dpa.data_platform_headers, params=params
    )
    response.raise_for_status() 

    provider_results = response.json()

    results = []

    if provider_results:
        results += [
            {
                'username': u['username'],
                'label': u['name'],
            } 
            for u in provider_results
        ]
    
    return jsonify(results)