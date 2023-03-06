import requests
from flask import (
    Blueprint,
    jsonify,
    session
)

from . import openid_login_required, current_user_api_token, API_URL

data_platform_autocomplete_bp = Blueprint(
    "data_platform_autocomplete_bp", __name__, template_folder="templates"
)

@data_platform_autocomplete_bp.route("/data-platform/autocomplete/username/<term>", methods=["GET"])
@openid_login_required
def autocomplete_username(term):
    token, perms = current_user_api_token()
    header = {"Authorization": "Bearer " + token}
    params = [('term', t) for t in term.split(' ')]

    providers = [session['openid_provider']]

    if 'operator' in perms or 'admin' in perms:
        providers = ['vsc', 'kuleuven']

    results = []

    for provider in providers:
        response = requests.get(
            f"{API_URL}/v1/users/autocomplete/{provider}", headers=header, params=params
        )
        response.raise_for_status() 

        provider_results = response.json()

        if provider_results:
            results += [
                {
                    'username': u['username'],
                    'label': u['name'],
                } 
                for u in provider_results
            ]
    
    return jsonify(results)