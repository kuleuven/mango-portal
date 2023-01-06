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
    helpers
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

metadata_schema_editor_bp = Blueprint(
    "metadata_schema_editor_bp", __name__, template_folder="templates/metadata_schema",
)


schema_base_dir = os.path.abspath("storage")

def get_metadata_schema_dir(irods_session: iRODSSession):
    # check if it exists and if not, then create it
    meta_data_schema_path = f"{schema_base_dir}/{irods_session.zone}/zone_schemas"
    if not os.path.exists(meta_data_schema_path):
        os.makedirs(meta_data_schema_path)
    return meta_data_schema_path


# Blueprint templates
@metadata_schema_editor_bp.route("/metadata-template", methods=["GET"])
def metadata_template():
    """
    """
    return render_template("metadata_template_module.html.j2")


@metadata_schema_editor_bp.route("/metadata-template/list", methods=["GET"])
def list_meta_data_templates():
    """
    """
    # template_files = glob.glob(get_metadata_schema_dir(g.irods_session) + "/*.json")
    template_files = glob.glob("static/metadata-templates/*.json")
    template_filenames = [
        base_file_name
        for template_file in template_files
        if (base_file_name := os.path.basename(template_file)) != "uischema.json"
    ]

    return json.dumps(
        [
            {
                "name": name,
                "url": url_for("metadata_schema_editor_bp.get_schema", schema=name),
            }
            for name in template_filenames
        ]
    )


@metadata_schema_editor_bp.route("/metadata-schema/get/<schema>")
def get_schema(schema: str):
    schema_path = get_metadata_schema_dir(g.irods_session) + f"/{schema}"
    return helpers.send_file(schema_path)


# Blueprint templates
def save_metadata_template(filename, contents):
    # normalize the filename, lowercase, no weird characters
    filename = f"{slugify(filename[:-5])}.json"
    with open(get_metadata_schema_dir(g.irods_session)+ "/" + filename, "w") as f:
        f.write(contents)
    return True


# Blueprint templates
@metadata_schema_editor_bp.route("/metadata-template/update", methods=["POST"])
@csrf.exempt
def update_meta_data_templates():
    """
    """
    template_name = request.form["template_name"]
    template_json = request.form["template_json"]
    save_metadata_template(template_name, template_json)

    return redirect(request.referrer)


@metadata_schema_editor_bp.route("/metadata-template/new", methods=["POST"])
@csrf.exempt
def new_meta_data_template():
    """
    """
    template_name = request.form["template_name"]
    template_json = request.form["template_json"]
    save_metadata_template(template_name, template_json)

    return redirect(request.referrer)


@metadata_schema_editor_bp.route("/metadata-template/delete", methods=["POST"])
@csrf.exempt
def delete_meta_data_template():
    """
    """
    template_name = template_name = request.form["template_name"]
    os.unlink("static/metadata-templates/" + template_name)
    return redirect(request.referrer)
