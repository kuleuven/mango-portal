import requests
from flask import (
    Blueprint,
    render_template,
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

    return render_template(
        "project/project_view.html.j2", project=project, zones=zones,
    )