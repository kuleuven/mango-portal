import requests
import json
import math
import pandas as pd
import pytz
import time
from datetime import datetime
from irods.session import iRODSSession
from irods.models import RuleExec
from flask import (
    Blueprint,
    render_template,
    redirect,
    request,
    url_for,
    session,
    flash,
    current_app,
)
from cache import cache
from signals import mango_signals
from csrf import csrf
from . import API_URL, current_user_api_token, openid_login_required, Session

data_platform_project_bp = Blueprint(
    "data_platform_project_bp", __name__, template_folder="templates"
)

project_changed = mango_signals.signal("project_changed")


def project_user_search_cache_update_listener(sender, **params):
    cache_item_path = f"view/{url_for('data_platform_project_bp.project_user_search')}"
    cache.delete(cache_item_path)


project_changed.connect(project_user_search_cache_update_listener)


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

    response = requests.get(
        f"{API_URL}/v1/projects/{project_name}/quota", headers=header
    )
    response.raise_for_status()

    quotalog = response.json()

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
        quotalog=quotalog,
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

    project_changed.send(current_app._get_current_object())

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

    project_changed.send(current_app._get_current_object())

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects/modify", methods=["POST"])
@openid_login_required
def modify_project():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    id = request.form.get("project")

    if "description" in request.form:
        data = {
            "type": request.form.get("type"),
            "description": request.form.get("description"),
            "sap_ref": request.form.get("sap_ref"),
            "an": request.form.get("an"),
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

    project_changed.send(current_app._get_current_object())

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
            "enable-sftp-ingress",
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

        project_changed.send(current_app._get_current_object())

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

    project_changed.send(current_app._get_current_object())

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
            "type": request.form.get("type"),
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

    project_changed.send(current_app._get_current_object())

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

    project_changed.send(current_app._get_current_object())

    return redirect(url_for("data_platform_project_bp.project", project_name=id))


@data_platform_project_bp.route("/data-platform/projects", methods=["GET"])
@openid_login_required
def project_overview():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    response = requests.get(f"{API_URL}/v1/irods/zones", headers=header)
    response.raise_for_status()

    zones = response.json()

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


def calculate_usage_percent(quota, usage):
    if quota == 0:
        return "No quota set!"
    if quota > 0 and usage == 0:
        return "0 %"
    usage_percent = (usage / quota) * 100
    return f"{round(usage_percent, 2)} %"


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
        if project["project"]["platform"] == "irods":
            zone_name = [
                "-".join(x["value"].split("-")[4:])
                for x in project["project"]["platform_options"]
                if x["key"] == "zone-jobid"
            ][0]
        else:
            zone_name = "Non iRODS"
        return {
            "zone_name": zone_name,
            "project_name": project["project"]["name"],
            "project_type": project["project"]["type"],
            "usage_total": convert_bytes_to_GB(
                [x["used_size"] for x in project["usage"]][-1]
            ),
            "quota_set": convert_bytes_to_GB(project["project"]["quota_size"]),
            "quota_usage_rate": calculate_usage_percent(
                project["project"]["quota_size"],
                [x["used_size"] for x in project["usage"]][-1],
            ),
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


def summarize(source_name: str, data: pd.DataFrame, y_axis: str, group_index: int, hovertemplate=""):
    def get_color(i):
        color_mapping = [
            '#4e79a7',
            '#f28e2c',
            '#e15759',
            '#76b7b2',
            '#59a14f',
            '#edc949',
            '#af7aa1',
            '#ff9da7',
            '#9c755f',
            '#bab0ab'
        ]
        return color_mapping[i]

    grouped_data = data.groupby("date")
    if y_axis == "usage":
        y = list(grouped_data.usage.agg("sum"))
    elif y_axis == "quota":
        y = list(grouped_data.quota.agg("sum"))
    else:
        raise ValueError("should be usage or quota")

    group_data = {
        "x": [month for month, _ in grouped_data],
        "y": y,
        "name": source_name,
        "marker": {"color": get_color(group_index)},
        "type": "bar",
    }
    if hovertemplate:
        group_data["hovertemplate"] = hovertemplate
    return group_data


def get_next_month(year_month: str):
    year, month = year_month.split("-")
    if month == "12":
        return f"{int(year)+1}-01"
    else:
        return f"{year}-{int(month)+1:02d}"


@data_platform_project_bp.route("/data-platform/statistics/usage", methods=["GET", "POST"])
@openid_login_required
@csrf.exempt
def projects_usage():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    start_date = "2023-01"
    end_date = str(time.strftime("%Y-%m"))
    start_date_year = int(start_date.split("-")[0])
    end_date_year = int(end_date.split("-")[0])

    if start_date_year == end_date_year:
        response = requests.get(f"{API_URL}/v1/projects/usage/{start_date_year}", headers=header)
        response.raise_for_status()
        projects = response.json()

    # Todos for incoming years:
    # rewrite the logic to get all projects for each response below.
    # else:
    #     projects = []
    #     for date in range(end_date_year - start_date_year):
    #         response = requests.get(f"{API_URL}/v1/projects/usage/{start_date_year+1}", headers=header)

    projects_dict = {}
    projects_dict["date"] = []
    projects_dict["zone"] = []
    projects_dict["project_name"] = []
    projects_dict["usage"] = []
    projects_dict["quota"] = []
    for project in projects:
        if project["project"]["platform"] == "irods":
            for usage in project["usage"]:
                projects_dict["date"].append(usage["date"])
                zone_name = [
                    "-".join(x["value"].split("-")[4:])
                    for x in project["project"]["platform_options"]
                    if x["key"] == "zone-jobid"
                ][0]
                projects_dict["zone"].append(zone_name)
                projects_dict["project_name"].append(project["project"]["name"])
                projects_dict["usage"].append(usage["used_size"])
                projects_dict["quota"].append(usage["quota_size"])

    df = pd.DataFrame(projects_dict)

    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "from_date": start_date,
        "to_date": end_date,
    }

    if request.method == "POST":
        filters["from_date"] = request.form.get("from-month", filters["from_date"])
        filters["to_date"] = request.form.get("to-month", filters["to_date"])
        df = df.loc[
            (df.date >= filters["from_date"])
            & (df.date < get_next_month(filters["to_date"]))
        ]

    all_groups = list(df.zone.unique())
    all_groups.sort()

    usage_plot = [
        summarize(
            source_name,
            data,
            "usage",
            all_groups.index(source_name),
            "%{y:.4s}B data used in %{x}",
        )
        for source_name, data in df.groupby("zone")
    ]

    quota_plot = [
        summarize(
            source_name,
            data,
            "quota",
            all_groups.index(source_name),
            "%{y:.4s}B quota set in %{x}",
        )
        for source_name, data in df.groupby("zone")
    ]

    return render_template(
        "project/projects_usage.html.j2",
        usage_plot=usage_plot,
        quota_plot=quota_plot,
        filters=filters,
    )


@data_platform_project_bp.route("/data-platform/project_user_search", methods=["GET"])
@openid_login_required
@cache.cached(timeout=3600)
def project_user_search():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    response = requests.get(f"{API_URL}/v1/projects", headers=header)
    response.raise_for_status()

    projects = response.json()

    projects_list = []
    for project in projects:
        if project["platform"] == "irods":
            zone_name = [
                "-".join(x["value"].split("-")[4:])
                for x in project["platform_options"]
                if x["key"] == "zone-jobid"
            ][0]
            projects_list.append((zone_name, project["name"], project["type"]))
        else:
            projects_list.append(("Non iRODS", project["name"], ""))
    project_list_of_dicts = []
    for project in projects_list:
        response = requests.get(
            f"{API_URL}/v1/projects/{project[1]}/members", headers=header
        )
        members = response.json()
        for member in members:
            project_list_of_dicts.append(
                {
                    "user_name": member["name"],
                    "user_account": member["username"],
                    "user_role": member["role"],
                    "user_email": member["email"],
                    "project_name": project[1],
                    "project_type": project[2],
                    "zone_name": project[0],
                }
            )

    return render_template(
        "project/project_user_search.html.j2",
        user_project_search_list=json.dumps(project_list_of_dicts),
    )


@data_platform_project_bp.route("/data-platform/rule-management", methods=["GET"])
@openid_login_required
def rule_management():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    def get_zones():
        response = requests.get(f"{API_URL}/v1/irods/zones", headers=header)
        response.raise_for_status()
        response = response.json()
        return [item["jobid"] for item in response]

    def get_irods_credentials(jobid):
        response = requests.post(
            f"{API_URL}/v1/irods/zones/{jobid}/admin_token", headers=header
        )
        response.raise_for_status()
        response = response.json()
        irods_environment = response["irods_environment"]
        password = response["token"]
        return irods_environment, password

    rule_info = []
    for zone in get_zones():
        zone_environment, password = get_irods_credentials(zone)
        with iRODSSession(**zone_environment, password=password) as session:
            query = session.query(
                RuleExec.name,
                RuleExec.id,
                RuleExec.user_name,
                RuleExec.time,
                RuleExec.last_exe_time,
                RuleExec.frequency,
            )
            for item in query:
                rule_info.append(list(item.values()))
                rule_info[-1].insert(0, session.zone)

    def localize_datetime(
        value, format="%Y-%m-%d %H:%M:%S", local_timezone="Europe/Brussels"
    ):
        tz = pytz.timezone(local_timezone)
        utc = pytz.timezone("UTC")
        value = utc.localize(value, is_dst=None).astimezone(pytz.utc)
        local_dt = value.astimezone(tz)
        local_dt = local_dt.strftime(format)
        return datetime.strptime(local_dt, format)

    for item in rule_info:
        if item[5] is not None:
            item[4] = localize_datetime(item[4])
            item[5] = localize_datetime(item[5])
            delta = item[4] - datetime.now().replace(microsecond=0)
            item.insert(4, delta)
        else:
            item.insert(4, "Not executed yet!")

    return render_template(
        "project/rule_management.html.j2",
        rule_info=rule_info,
    )


@data_platform_project_bp.route("/data-platform/quota-change", methods=["GET"])
@openid_login_required
def project_quota_change():
    token, _ = current_user_api_token()
    header = {"Authorization": "Bearer " + token}

    response = requests.get(f"{API_URL}/v1/projects/quota", headers=header)

    response.raise_for_status()

    projects = response.json()

    projects_list = []
    for project in projects:
        for day in project["log"]:
            projects_list.append(
                {
                    "project_name": project["name"],
                    "project_create": project["log"][0]["date"],
                    "project_type": project["type"],
                    "project_status": (f"Active" if day["archived"]==False else "Archived"),
                    "sap_ref": project["sap_ref"],
                    "an": project["an"],
                    "quota_set": convert_bytes_to_GB(
                        day["quota_size"], conversion_to="TB"
                    ) if day["archived"]==False else None,
                    "quota_set_date": None if (day["quota_size"]==0 or day["archived"]==True) else day["date"],
                    "modified_by": day["modified_by"],
                }
            )

    return render_template(
        "project/projects_quota_change.html.j2",
        projects_list=json.dumps(projects_list),
    )
