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
    realms = [sub_collection.name for sub_collection in project_collections]
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

    return render_template("metadata_schema_module.html.j2", realms=realms, realm=realm)


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
    schemas: dict = schema_manager.list_schemas()

    return json.dumps(
        [
            {
                "name": schema,
                "url": url_for(
                    "metadata_schema_editor_bp.get_schema",
                    realm=realm,
                    schema=schema,
                    status="status",
                ),
                "schema_info": schema_info,
            }
            for (schema, schema_info) in schemas.items()
        ]
    )


@metadata_schema_editor_bp.route(
    "/metadata-schema/get/<realm>/<schema>/<status>", methods=["GET"]
)
def get_schema(realm: str, schema: str, status="published"):
    schema_manager = get_schema_manager(g.irods_session.zone, realm)
    schema_content = schema_manager.load_schema(
        schema_name=schema, realm=realm, status=status
    )
    if schema_content:
        return Response(schema_content, status=200, mimetype="application/json")
    else:
        return Response("error, no content found", status=404)


@metadata_schema_editor_bp.route("/metadata-schema/save", methods=["POST"])
@csrf.exempt
def save_schema():
    if "realm" in request.form:
        schema_manager = get_schema_manager(g.irods_session.zone, request.form["realm"])
        return schema_manager.store_schema(
            schema_name=request.form["schema_name"],
            current_version=request.form["current_version"],
            raw_schema=json.loads(request.form["raw_schema"]),
            with_status=request.form["with_status"],
            title=request.form["title"],
            username=g.irods_session.username,
        )


@metadata_schema_editor_bp.route("/metadata-schema/delete", methods=["POST", "DELETE"])
@csrf.exempt
def delete_meta_data_schema():
    """ """
    if "realm" in request.form:
        schema_manager = get_schema_manager(g.irods_session.zone, request.form["realm"])
        if request.form["with_status"] != "draft":
            return False
        return schema_manager.delete_draft_schema(
            schema_name=request.form["schema_name"]
        )

    return redirect(request.referrer)
