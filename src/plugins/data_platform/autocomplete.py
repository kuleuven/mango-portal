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

    response = requests.get(
        f"{API_URL}/v1/users/autocomplete", headers=header, params=params
    )
    response.raise_for_status() 

    result = response.json()

    if not result:
        return jsonify([])

    # Limit suggestions to the right 'source'
    vsc = session['openid_provider'] == 'VSC'
    admin = 'operator' in perms or 'admin' in perms

    return jsonify([
        {
            'username': u['username'],
            'label': u['name'],
        } 
        for u in result
        if u['username'].startswith('vsc') == vsc or admin
    ])


username_cache = {}

def resolve_full_name(username):
    if username in username_cache:
        return username_cache[username]

    print("looking up user", username)
    
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}
    params = [('term', username)]

    response = requests.get(
        f"{API_URL}/v1/users/autocomplete", headers=header, params=params
    )
    response.raise_for_status() 

    result = response.json()
    if not result or len(result) != 1:
        return ""
    
    if result[0]['name']:
        username_cache[username] = result[0]['name']

    return result[0]['name']