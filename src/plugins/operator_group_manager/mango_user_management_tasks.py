import os

import requests
from celery import shared_task

from plugins.mango_flow import MangoFlowTask
from plugins.mango_flow.lib.util import read_yaml_from_string, write_yaml_to_data_object
from plugins.operator import get_zone_operator_session

API_URL = os.getenv("API_URL", "")
API_TOKEN = os.getenv("API_TOKEN", "")


@shared_task(
    name="mango_flow.tasks.mango_user_management.validate_and_upload_yaml",
    bind=True,
    base=MangoFlowTask,
)
def validate_and_upload_yaml_task(
    self, path: str, file_contents: str, client_user: str
):
    """
    Task to validate and upload file with user management configuration.
    Called ad hoc, from a route that takes care of creating the destination collection if it does not exist
    """

    # validation??
    yaml_contents = read_yaml_from_string(file_contents)
    path_parts = path.split("/")  # e.g. /zone/mango/realm/user_management/filename.py
    zone = path_parts[1]
    irods_session = get_zone_operator_session(zone=zone, client_user=client_user)
    write_yaml_to_data_object(str(path_parts), yaml_contents, irods_session)
    return str(path_parts)


@shared_task(
    name="mango_flow.tasks.mango_user_management.update_mango_users_groups_from_yaml",
    bind=True,
    base=MangoFlowTask,
)
def update_mango_users_groups_from_yaml_task(self, task_data: dict[str, dict | str]):
    """
    Task to update users in ManGO and return dict of groups and users to update
    """
    yaml_data = task_data.get("yaml_data", {})
    realm = task_data.get("realm", None)

    if not realm:
        raise ValueError("Realm is required")

    yaml_data = {
        (k if k.startswith(realm) else f"{realm}_{k}"): v for k, v in yaml_data.items()
    }
    return {
        "yaml_data": update_users_mango(yaml_data, realm),
        "zone": task_data.get("zone", None),
        "realm": realm,
    }


def update_users_mango(yaml_data: dict, realm: str):
    protected_groups = {f"{realm}_{role}": role for role in ["manager", "responsible"]}
    machine_accounts = [f"{realm}_pipeline"]

    existing_users = get_members(realm)

    yaml_users = set(
        user
        for group in yaml_data.values()
        for user in group
        if user not in machine_accounts
    )

    added_users = [user for user in yaml_users if user not in existing_users]
    # delete users that are gone, except special roles
    removed_users = [
        user
        for user, role in existing_users.items()
        if user not in yaml_users and role not in protected_groups.values()
    ]
    for user in removed_users:
        update_user(realm, user)

    # new users in protected roles / upgraded users
    protected_role_users = []

    # check protected groups
    for group_name, group_role in protected_groups.items():  # dealt with first
        if group_role == "responsible":
            continue  # do not attempt to modify responsible
        if group_name not in yaml_data or not isinstance(yaml_data[group_name], list):
            # if the group is not defined here, it is left unchanged
            continue
        old_users = [
            user for user, role in existing_users.items() if role == group_role
        ]
        group_yaml_users = yaml_data[group_name]
        if not isinstance(group_yaml_users, list):
            raise ValueError(
                f"Invalid updated users for group {group_name}: {group_yaml_users}"
            )
        added = [user for user in group_yaml_users if user not in old_users]
        removed = [user for user in old_users if user not in group_yaml_users]
        for user in added:
            # either a new user or upgraded to this role
            update_user(realm, user, group_role)
        for user in removed:
            update_user(
                realm, user, "member" if user in yaml_users else None
            )  # downgraded or removed
        protected_role_users += added

    for user in added_users:
        if user not in protected_groups:
            update_user(realm, user, "member")

    return {
        k: v for k, v in yaml_data.items() if (k not in protected_groups and k != realm)
    }


def get_members(project: str) -> dict:
    """Get a dictionary with the user names as keys and their roles as values"""
    header = {"Authorization": "Bearer " + API_TOKEN}
    response = requests.get(f"{API_URL}/v1/projects/{project}/members", headers=header)
    response.raise_for_status()
    return {member["username"]: member["role"] for member in response.json()}


def update_user(project: str, username: str, role: str = None):
    header = {"Authorization": "Bearer " + API_TOKEN}
    endpoint = f"{API_URL}/v1/projects/{project}/members/{username}"
    valid_roles = ["member", "manager", "responsible", "support"]

    if role in valid_roles:
        # add a user
        response = requests.put(
            endpoint,
            headers=header,
            json={
                "role": role,
            },
        )
    elif role is None:
        # delete user
        response = requests.delete(endpoint, headers=header)
    else:
        raise ValueError(f"Role must be one of {'/'.join(valid_roles)} or `None`.")
    response.raise_for_status()

    # apply changes in  iRODS
    requests.post(f"{API_URL}/v1/projects/{project}/deploy", headers=header, json={})
