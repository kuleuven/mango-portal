import requests
from flask import (
    Blueprint,
    render_template,
    redirect,
    request,
    url_for,
    session,
    flash,
)

from . import API_URL, current_user_api_token


data_platform_project_bp = Blueprint(
    "data_platform_project_bp", __name__, template_folder="templates"
)


@data_platform_project_bp.route("/data-platform/project/<project_name>", methods=["GET"])
def project(project_name):
    header = {"Authorization": "Bearer " + current_user_api_token()}

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

    # find out whether we are project owner
    my_project_role = ""

    for m in project['members']:
        if m['username'] == session['openid_username']:
            my_project_role = m['role']

    return render_template(
        "project/project_view.html.j2", project=project, zones=zones, my_project_role=my_project_role,
    )

@data_platform_project_bp.route("/data-platform/projects/member/add", methods=["POST"])
def add_project_member():
    header = {"Authorization": "Bearer " + current_user_api_token()}

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

@data_platform_project_bp.route("/data-platform/projects/member/delete", methods=["POST"])
def delete_project_member():
    header = {"Authorization": "Bearer " + current_user_api_token()}

    id = request.form.get('project')
    username = request.form.get('username')

    response = requests.delete(
        f"{API_URL}/v1/projects/{id}/members/{username}", headers=header
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")
    
    return redirect(url_for('data_platform_project_bp.project', project_name=id))

@data_platform_project_bp.route("/data-platform/projects/deploy", methods=["POST"])
def deploy_project():
    header = {"Authorization": "Bearer " + current_user_api_token()}

    id = request.form.get('project')

    response = requests.post(
        f"{API_URL}/v1/projects/{id}/deploy", headers=header
    )
    response.raise_for_status()

    flash(response.json()['message'], "success")
    
    return redirect(url_for('data_platform_project_bp.project', project_name=id))