import requests
import json
import math
import pandas as pd
import plotly
import plotly.express as px
import plotly.graph_objects as go
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

from . import API_URL, current_user_api_token, openid_login_required, Session

data_platform_project_bp = Blueprint(
    "data_platform_project_bp", __name__, template_folder="templates"
)


@data_platform_project_bp.route(
    "/data-platform/project/<project_name>", methods=["GET"]
)
@openid_login_required
def project(project_name):
    token, perms = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    response = requests.get(f"{API_URL}/v1/irods/zones", headers=header)
    response.raise_for_status()

    zones = response.json()

    response = requests.get(f"{API_URL}/v1/projects/{project_name}", headers=header)
    response.raise_for_status()

    project = response.json()

    response = requests.get(
        f"{API_URL}/v1/projects/{project_name}/members", headers=header
    )
    response.raise_for_status()

    project["members"] = response.json()

    response = requests.get(
        f"{API_URL}/v1/projects/{project_name}/status", headers=header
    )
    response.raise_for_status()

    status = response.json()

    project["activated"] = (
        not project["archived"]
        or not project["valid_after"]
        or datetime.strptime(project["valid_after"], "%Y-%m-%d") < datetime.now()
    )

    # find out whether we are project owner
    project["my_role"] = ""
    project["responsibles"] = 0

    for m in project["members"]:
        if m["username"] == Session(session["openid_session"]).username:
            project["my_role"] = m["role"]
        if m["role"] == "responsible":
            project["responsibles"] += 1

    if project["platform"] == "irods":
        response = requests.get(
            f"{API_URL}/v1/irods/projects/{project_name}/machine_token", headers=header
        )
        response.raise_for_status()

        project["machine_tokens"] = response.json()

        for t in project["machine_tokens"]:
            t["expiration"] = datetime.strptime(t["expiration"], "%Y-%m-%dT%H:%M:%S%z")

    return render_template(
        "project/project_view.html.j2",
        project=project,
        status=status,
        zones=zones,
        admin=("operator" in perms or "admin" in perms),
    )


@data_platform_project_bp.route("/data-platform/projects/member/add", methods=["POST"])
@openid_login_required
def add_project_member():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")
    username = request.form.get("username")
    role = request.form.get("role")

    response = requests.put(
        f"{API_URL}/v1/projects/{id}/members/{username}",
        headers=header,
        json={
            "role": role,
        },
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route(
    "/data-platform/projects/member/delete", methods=["POST"]
)
@openid_login_required
def delete_project_member():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")
    username = request.form.get("username")

    response = requests.delete(
        f"{API_URL}/v1/projects/{id}/members/{username}", headers=header
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects/modify", methods=["POST"])
@openid_login_required
def modify_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")

    if "description" in request.form:
        data = {
            "description": request.form.get("description"),
            "sap_ref": request.form.get("sap_ref"),
            "vsc_call": request.form.get("vsc_call"),
            "valid_after": request.form.get("valid_after"),
            "invalid_after": request.form.get("invalid_after"),
        }

        now = datetime.now()

        if (
            data["invalid_after"]
            and datetime.strptime(data["invalid_after"], "%Y-%m-%d") < now
        ):
            data["archived"] = True
        elif (
            data["valid_after"]
            and datetime.strptime(data["valid_after"], "%Y-%m-%d") < now
        ):
            data["archived"] = False
        elif data["valid_after"]:
            data["archived"] = True

    elif "quota_inodes" in request.form:
        data = {
            "quota_inodes": int(request.form.get("quota_inodes")),
            "quota_size": int(request.form.get("quota_size")),
        }

    response = requests.patch(
        f"{API_URL}/v1/projects/{id}",
        headers=header,
        json=data,
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects/option", methods=["POST"])
@openid_login_required
def set_project_options():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")

    response = requests.get(f"{API_URL}/v1/projects/{id}", headers=header)
    response.raise_for_status()

    project = response.json()

    options = ["gdpr-data"]

    if project["platform"].startswith("irods"):
        options += [
            "sftp-openfile",
            "enable-icommands",
            "enforce-quota",
            "inherit-permissions",
            "strict-permissions",
        ]

    for key in options:
        value = request.form.get(key, "false")

        skip = False

        for opt in project["platform_options"]:
            if opt["key"] == key and opt["value"] == value:
                skip = True

        if skip:
            continue

        response = requests.put(
            f"{API_URL}/v1/projects/{id}/option/{key}",
            headers=header,
            json={"value": value},
        )
        response.raise_for_status()

        flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects/deploy", methods=["POST"])
@openid_login_required
def deploy_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")

    now = datetime.now().strftime("%Y-%m-%d")

    if request.form.get("submit") == "Archive":
        response = requests.patch(
            f"{API_URL}/v1/projects/{id}",
            headers=header,
            json={"archived": True, "invalid_after": now},
        )
        response.raise_for_status()

    if request.form.get("submit") == "Unarchive":
        response = requests.patch(
            f"{API_URL}/v1/projects/{id}",
            headers=header,
            json={"archived": False, "valid_after": now},
        )
        response.raise_for_status()

    if request.form.get("submit") == "Delete":
        response = requests.delete(
            f"{API_URL}/v1/projects/{id}",
            headers=header,
        )
        response.raise_for_status()

        flash(response.json()["message"], "success")

        return redirect(url_for("data_platform_user_bp.login_openid_select_zone"))

    response = requests.post(
        f"{API_URL}/v1/projects/{id}/deploy", headers=header, json={}
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route(
    "/data-platform/project/<project_name>/api_token/<type>", methods=["GET", "POST"]
)
@openid_login_required
def api_token(project_name, type):
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    if request.method == "GET":
        response = requests.get(
            f"{API_URL}/v1/irods/projects/{project_name}/machine_token", headers=header
        )
        response.raise_for_status()

        current_machine_tokens = response.json()

        for t in current_machine_tokens:
            t["expiration"] = datetime.strptime(t["expiration"], "%Y-%m-%dT%H:%M:%S%z")

        return render_template(
            "project/api_token.html.j2",
            project_name=project_name,
            type=type,
            current_machine_tokens=current_machine_tokens,
        )

    response = requests.post(
        f"{API_URL}/v1/irods/projects/{project_name}/machine_token",
        headers=header,
        json={"type": type},
    )
    response.raise_for_status()

    info = response.json()

    info["expiration"] = datetime.strptime(info["expiration"], "%Y-%m-%dT%H:%M:%S%z")

    return render_template(
        "project/api_token_connection_info.html.j2",
        project_name=project_name,
        type=type,
        info=info,
        setup_json=json.dumps(info["irods_environment"], indent=4),
    )


@data_platform_project_bp.route("/data-platform/projects/add/irods", methods=["POST"])
@openid_login_required
def add_irods_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("name")

    response = requests.put(
        f"{API_URL}/v1/projects/{id}",
        headers=header,
        json={
            "platform": request.form.get("platform"),
            "platform_options": [
                {
                    "key": "zone-jobid",
                    "value": request.form.get("zone"),
                },
                {
                    "key": "folder-layout",
                    "value": request.form.get("layout"),
                },
            ],
        },
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects/add/generic", methods=["POST"])
@openid_login_required
def add_generic_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("name")

    response = requests.put(
        f"{API_URL}/v1/projects/{id}",
        headers=header,
        json={
            "platform": "generic",
        },
    )
    response.raise_for_status()

    flash(response.json()["message"], "success")

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects", methods=["GET"])
@openid_login_required
def project_overview():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    year = request.args.get("year")

    if not year:
        year = datetime.now().year

    response = requests.get(f"{API_URL}/v1/projects/usage/{year}", headers=header)

    response.raise_for_status()

    projects = response.json()

    if not projects:
        flash(f"No project information found in {year}.")
        projects = []

    projects = sorted(projects, key=lambda p: p["project"]["name"])

    return render_template(
        "project/projects_overview.html.j2",
        projects=projects,
        year=year,
    )


def convert_bytes_to_GB(size_bytes, conversion_to="GB"):
    if size_bytes == 0:
        return 0
    power = {"B": 0, "KB": 1, "MB": 2, "GB": 3, "TB": 4, "EB": 5, "ZB": 6, "YB": 7}
    index = power[conversion_to]
    p = math.pow(1000, index)
    float_size = round(size_bytes / p, 2)
    return round(float_size, 2)


@data_platform_project_bp.route("/data-platform/statistics", methods=["GET"])
@openid_login_required
def projects_statistics():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    year = request.args.get("year")

    if not year:
        year = datetime.now().year

    response = requests.get(f"{API_URL}/v1/projects/usage/{year}", headers=header)

    response.raise_for_status()

    projects = response.json()

    if not projects:
        flash(f"No project information found in {year}.")
        projects = []

    def create_project_dict(project):
        zone_name = (
            "-".join(project["project"]["platform_options"][0]["value"].split("-")[4:])
            if project["project"]["platform"] == "irods"
            else "Non iRODS"
        )
        return {
            "zone_name": zone_name,
            "project_name": project["project"]["name"],
            "usage_total": convert_bytes_to_GB(
                [x["used_size"] for x in project["usage"]][-1]
            ),
            "quota_set": convert_bytes_to_GB(project["project"]["quota_size"]),
            "responsible_name": project["responsibles"][0]["name"]
            if project["responsibles"] != None
            else "",
            "responsible_account": project["responsibles"][0]["username"]
            if project["responsibles"] != None
            else "",
            "sap_ref": project["project"]["sap_ref"],
        }

    projects_list = [create_project_dict(project) for project in projects]

    return render_template(
        "project/projects_statistics.html.j2",
        year=year,
        projects_list=json.dumps(projects_list),
    )


@data_platform_project_bp.route("/data-platform/statistics/usage", methods=["GET"])
@openid_login_required
def projects_usage():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    year = request.args.get("year")

    if not year:
        year = datetime.now().year

    response = requests.get(f"{API_URL}/v1/projects/usage/{year}", headers=header)

    response.raise_for_status()

    projects = response.json()

    if not projects:
        flash(f"No project information found in {year}.")
        projects = []

    projects_dic = {}
    projects_dic["date"] = []
    projects_dic["zone"] = []
    projects_dic["project_name"] = []
    projects_dic["usage"] = []
    projects_dic["quota"] = []
    for project in projects:
        if project["project"]["platform"] == "irods":
            for usage in project["usage"]:
                projects_dic["date"].append(usage["date"])
                zone_name = "-".join(
                    project["project"]["platform_options"][0]["value"].split("-")[4:]
                )
                projects_dic["zone"].append(zone_name)
                projects_dic["project_name"].append(project["project"]["name"])
                projects_dic["usage"].append(convert_bytes_to_GB(usage["used_size"]))
                projects_dic["quota"].append(convert_bytes_to_GB(usage["quota_size"]))

    df_raw = pd.DataFrame(projects_dic)
    df = (
        df_raw.groupby(["date", "zone", "quota", "project_name"])["usage"]
        .sum()
        .reset_index(name="used_size")
    )

    fig_usage = px.histogram(
        df, x="date", y=df["used_size"], color="zone", barmode="stack", text_auto=True
    )
    fig_usage.update_layout(
        title="Usage Per Zone",
        title_x=0.5,
        autosize=True,
        margin=dict(
            autoexpand=True,
            l=100,
            r=20,
            t=110,
        ),
        plot_bgcolor="white",
    )

    fig_quota = px.histogram(
        df, x="date", y=df["quota"], color="zone", barmode="stack", text_auto=True
    )
    fig_quota.update_layout(
        title="Quota Per Zone",
        title_x=0.5,
        autosize=True,
        margin=dict(
            autoexpand=True,
            l=100,
            r=20,
            t=110,
        ),
        plot_bgcolor="white",
    )

    return render_template(
        "project/projects_usage.html.j2",
        year=year,
        usage_graphJSON=json.dumps(fig_usage, cls=plotly.utils.PlotlyJSONEncoder),
        quota_graphJSON=json.dumps(fig_quota, cls=plotly.utils.PlotlyJSONEncoder),
    )
