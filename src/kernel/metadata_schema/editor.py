from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    g,
    send_file,
    abort,
    stream_with_context,
    Response,
    request,
    flash,
    helpers,
    session,
)

from irods.meta import iRODSMeta
from irods.session import iRODSSession

from PIL import Image
from pdf2image import convert_from_path
import mimetypes
import tempfile
from urllib.parse import unquote

from lib.util import generate_breadcrumbs
import magic
import os
import glob
import json
from pprint import pprint
import lib.util

# from flask_wtf import CSRFProtect
from csrf import csrf

from slugify import slugify

from cache import cache
from . import get_schema_manager

metadata_schema_editor_bp = Blueprint(
    "metadata_schema_editor_bp",
    __name__,
    template_folder="templates/metadata_schema",
)


from mango_ui import register_module

UI = {
    "title": "Metadata schemas",
    "bootstrap_icon": "list-columns-reverse",
    "description": "Basic info about the current node",
    "blueprint": metadata_schema_editor_bp.name,
    "index": "metadata_schemas",
}

register_module(**UI)

schema_base_dir = os.path.abspath("storage")


def get_metadata_schema_dir(irods_session: iRODSSession):
    # check if it exists and if not, then create it
    meta_data_schema_path = f"{schema_base_dir}/{irods_session.zone}/zone_schemas"
    if not os.path.exists(meta_data_schema_path):
        os.makedirs(meta_data_schema_path)
    return meta_data_schema_path


@cache.memoize(1200)
def get_realms_for_current_user(irods_session: iRODSSession, base_path):
    # for now a simple listing of everything found in the home collection
    project_collections = irods_session.collections.get(base_path).subcollections
    realms = [
        sub_collection.name
        for sub_collection in project_collections
        if sub_collection.name != "public"
    ]
    return realms


@metadata_schema_editor_bp.route(
    "/metadata-schemas", defaults={"realm": None}, methods=["GET"]
)
@metadata_schema_editor_bp.route("/metadata-schemas/<realm>", methods=["GET"])
def metadata_schemas(realm):
    """ """
    realms = get_realms_for_current_user(g.irods_session, g.zone_home)
    # save the realm in the session if set, otherwise make sure it is not set
    if realm:
        session["current_schema_editor_realm"] = realm
    elif "current_schema_editor_realm" in session:
        del session["current_schema_editor_realm"]

    return render_template(
        "metadata_schema_module.html.j2",
        realms=realms,
        realm=realm,
        schema_name=request.values.get("schema_name", ""),
        schema_version=request.values.get("schema_version", ""),
    )


@metadata_schema_editor_bp.route(
    "/metadata-schema/list", defaults={"realm": None}, methods=["GET"]
)
@metadata_schema_editor_bp.route("/metadata-schema/list/<realm>", methods=["GET"])
def list_meta_data_schemas(realm):
    """ """
    if not realm and ("current_schema_editor_realm" not in session):
        redirect(url_for("metadata_schema_editor_bp.metadata_schemas"))
    if not realm:
        realm = session["current_schema_editor_realm"]
    schema_manager = get_schema_manager(g.irods_session.zone, realm)
    schemas: dict = schema_manager.list_schemas(
        filters=["published", "draft", "archived"]
    )

    # permissions setting and basic check
    schemas_to_remove = []
    for schema in schemas:
        current_user_permissions = schemas[schema][
            "current_user_permissions"
        ] = schema_manager.get_user_permissions_schema(g.irods_session, schema)
        if current_user_permissions == schema_manager.permission_manager.deny_all:
            schemas_to_remove.append(schema)
            continue
        if (
            current_user_permissions
            == schema_manager.permission_manager.schema_permissions["read_schema"]
        ) and not schemas[schema]["published"]:
            schemas_to_remove.append(schema)
            continue

    for schema in schemas_to_remove:
        schemas.pop(schema, None)

    return json.dumps(
        {
            "realm_permissions": schema_manager.get_user_permissions_realm(
                g.irods_session
            ),
            "schemas": [
                {
                    "name": schema,
                    "url": url_for(
                        "metadata_schema_editor_bp.get_schema",
                        realm=realm,
                        schema=schema,
                    ),
                    "schema_info": schema_info,
                }
                for (schema, schema_info) in schemas.items()
            ],
        }
    )


@metadata_schema_editor_bp.route(
    "/metadata-schema/get/<realm>/<schema>", methods=["GET"]
)
def get_schema(realm: str, schema: str):
    schema_manager = get_schema_manager(g.irods_session.zone, realm)
    if version := request.values.get("version", None):
        schema_content = schema_manager.load_schema(schema_name=schema, version=version)
    else:
        status = request.values.get("status", "published")
        schema_content = schema_manager.load_schema(schema_name=schema, status=status)
    if schema_content:
        return Response(schema_content, status=200, mimetype="application/json")
    else:
        return Response("error, no content found", status=404)


@metadata_schema_editor_bp.route("/metadata-schema/save", methods=["POST"])
@csrf.exempt
def save_schema():
    if "realm" in request.form:
        schema_manager = get_schema_manager(g.irods_session.zone, request.form["realm"])
        raw_schema = {}
        # either we get a json string or a decoded json string
        try:
            raw_schema = json.loads(request.form["raw_schema"])
        except Exception as e:
            raw_schema = json.loads(lib.util.atob(request.form["raw_schema"]))

        result = schema_manager.store_schema(
            schema_name=request.form["schema_name"],
            current_version=request.form["current_version"],
            raw_schema=raw_schema,
            with_status=request.form["with_status"],
            title=request.form["title"],
            username=g.irods_session.username,
            parent=request.form["parent"] if "parent" in request.form else "",
        )
    for key, value in result.items():
        if not value["valid"]:
            flash(f"Problem for {key}: {value['message']}", "danger")
    realm = request.form.get("realm", "")
    return redirect(
        url_for("metadata_schema_editor_bp.metadata_schemas", realm=realm)
        + f"?schema_name={request.form['schema_name']}&schema_version={request.form['current_version']}"
    )


@metadata_schema_editor_bp.route("/metadata-schema/delete", methods=["POST", "DELETE"])
@csrf.exempt
def delete_meta_data_schema():
    """ """
    if "realm" in request.form:
        schema_manager = get_schema_manager(g.irods_session.zone, request.form["realm"])
        if request.form["with_status"] != "draft":
            abort(400, "Can only delete draft versions of schemas")
        schema_manager.delete_draft_schema(schema_name=request.form["schema_name"])

    realm = request.form.get("realm", "")
    return redirect(
        url_for("metadata_schema_editor_bp.metadata_schemas", realm=realm)
        + f"?schema_name={request.form['schema_name']}&schema_version={request.form.get('current_version', '')}"
    )


@metadata_schema_editor_bp.route("/metadata-schema/archive", methods=["POST"])
@csrf.exempt
def archive_meta_data_schema():
    """ """
    if "realm" in request.form:
        schema_manager = get_schema_manager(g.irods_session.zone, request.form["realm"])
        if request.form["with_status"] != "published":
            abort(400, "Can only archive published versions of schemas")
        schema_manager.archive_published_schema(schema_name=request.form["schema_name"])

    realm = request.form.get("realm", "")
    return redirect(
        url_for("metadata_schema_editor_bp.metadata_schemas", realm=realm)
        + f"?schema_name={request.form['schema_name']}&schema_version={request.form.get('current_version', '')}"
    )
