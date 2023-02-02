import requests
from flask import (
    Blueprint,
    render_template,
    redirect,
    request,
    url_for,
    session,
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
    return redirect(url_for('data_platform_project_bp.project', project_name=request.form.get('project')))

@data_platform_project_bp.route("/data-platform/projects/member/modify", methods=["POST"])
def modify_project_member():
    return redirect(url_for('data_platform_project_bp.project', project_name=request.form.get('project')))

@data_platform_project_bp.route("/data-platform/projects/member/delete", methods=["POST"])
def delete_project_member():
    return redirect(url_for('data_platform_project_bp.project', project_name=request.form.get('project')))