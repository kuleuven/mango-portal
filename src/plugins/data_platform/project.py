import requests
import json
from datetime import datetime
from flask import (
    Blueprint,
    render_template,
    redirect,
    request,
    url_for,
    session,
    flash,
)

from . import API_URL, current_user_api_token, openid_login_required


data_platform_project_bp = Blueprint(
    "data_platform_project_bp", __name__, template_folder="templates"
)

@openid_login_required
@data_platform_project_bp.route("/data-platform/project/<project_name>", methods=["GET"])
def project(project_name):
    token, perms = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    response = requests.get(
        f"{API_URL}/v1/irods/zones", headers=header
    )
    response.raise_for_status() 

    zones = response.json()

    response = requests.get(
        f"{API_URL}/v1/projects/{project_name}", headers=header
    )
    response.raise_for_status()

    project = response.json()

    response = requests.get(
        f"{API_URL}/v1/projects/{project_name}/status", headers=header
    )
    response.raise_for_status()

    status = response.json()

    # find out whether we are project owner
    project['my_role'] = ""

    for m in project['members']:
        if m['username'] == session['openid_username']:
            project['my_role'] = m['role']

    if project['platform'] == 'irods':
        response = requests.get(
            f"{API_URL}/v1/irods/projects/{project_name}/machine_token", headers=header
        )
        response.raise_for_status()

        project['machine_tokens'] = response.json()

        for t in project['machine_tokens']:
            t['expiration'] = datetime.strptime(t['expiration'], '%Y-%m-%dT%H:%M:%S%z')

    return render_template(
        "project/project_view.html.j2", project=project, status=status, zones=zones, admin=('operator' in perms or 'admin' in perms),
    )

@openid_login_required
@data_platform_project_bp.route("/data-platform/projects/member/add", methods=["POST"])
def add_project_member():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get('project')
    username = request.form.get('username')
    role = request.form.get('role')

    response = requests.put(
        f"{API_URL}/v1/projects/{id}/members/{username}", headers=header, json={
            "role": role,
        }
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")

    return redirect(url_for('data_platform_project_bp.project', project_name=id))

@openid_login_required
@data_platform_project_bp.route("/data-platform/projects/member/delete", methods=["POST"])
def delete_project_member():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get('project')
    username = request.form.get('username')

    response = requests.delete(
        f"{API_URL}/v1/projects/{id}/members/{username}", headers=header
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")
    
    return redirect(url_for('data_platform_project_bp.project', project_name=id))

@openid_login_required
@data_platform_project_bp.route("/data-platform/projects/deploy", methods=["POST"])
def deploy_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get('project')

    if request.form.get('submit') == 'Archive':
        response = requests.patch(
            f"{API_URL}/v1/projects/{id}", headers=header, json={"archived": True}
        )
        response.raise_for_status()

    if request.form.get('submit') == 'Unarchive':
        response = requests.patch(
            f"{API_URL}/v1/projects/{id}", headers=header, json={"archived": False}
        )
        response.raise_for_status()

    response = requests.post(
        f"{API_URL}/v1/projects/{id}/deploy", headers=header, json={}
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")
    
    return redirect(url_for('data_platform_project_bp.project', project_name=id))

@openid_login_required
@data_platform_project_bp.route("/data-platform/project/<project_name>/api_token/<type>", methods=["GET", "POST"])
def api_token(project_name, type):
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    if request.method == 'GET':
        response = requests.get(
            f"{API_URL}/v1/irods/projects/{project_name}/machine_token", headers=header
        )
        response.raise_for_status()

        current_machine_tokens = response.json()

        for t in current_machine_tokens:
            t['expiration'] = datetime.strptime(t['expiration'], '%Y-%m-%dT%H:%M:%S%z')

        return render_template(
            "project/api_token.html.j2", project_name=project_name, type=type, current_machine_tokens=current_machine_tokens,
        )

    response = requests.post(
        f"{API_URL}/v1/irods/projects/{project_name}/machine_token", headers=header, json={"type": type},
    )
    response.raise_for_status()

    info = response.json()

    info['expiration'] = datetime.strptime(info['expiration'], '%Y-%m-%dT%H:%M:%S%z')

    return render_template(
        "project/api_token_connection_info.html.j2", project_name=project_name, type=type,
        info=info,
        setup_json=json.dumps(info['irods_environment'], indent=4),
    )

@openid_login_required
@data_platform_project_bp.route("/data-platform/projects/add", methods=["POST"])
def add_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get('name')

    response = requests.put(
        f"{API_URL}/v1/projects/{id}", headers=header, json={
            "platform": "irods",
            "platform_options": [
                {
                    "key": "zone-jobid",
                    "value": request.form.get('zone'),
                },
                {
                    "key": "folder-layout",
                    "value": request.form.get('layout'),
                },
            ],
        }
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")

    return redirect(url_for('data_platform_project_bp.project', project_name=id))