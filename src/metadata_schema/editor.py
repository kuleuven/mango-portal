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
)

from irods.meta import iRODSMeta

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


json_template_dir = os.path.abspath("static/metadata-templates")

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
    template_files = glob.glob(json_template_dir + "/*.json")
    # template_files = glob.glob("static/metadata-templates/*.json")
    template_filenames = [
        os.path.basename(template_file)
        for template_file in template_files
        if os.path.basename(template_file) != "uischema.json"
    ]

    return json.dumps(
        [
            {
                "name": name,
                "url": url_for("static", filename="metadata-templates/" + name),
            }
            for name in template_filenames
        ]
    )


"""
Single get not needed for now, static resources
@app.route("/metadata-template/get", methods=["GET"])
def get_meta_data_template():
    return redirect(request.referrer)
"""

# Blueprint templates
def save_metadata_template(filename, contents):
    # normalize the filename, lowercase, no weird characters
    filename = f"{slugify(filename[:-5])}.json"
    with open("static/metadata-templates/" + filename, "w") as f:
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


# Blueprint templates
@metadata_schema_editor_bp.route("/metadata-template/new", methods=["POST"])
@csrf.exempt
def new_meta_data_template():
    """
    """
    template_name = request.form["template_name"]
    template_json = request.form["template_json"]
    save_metadata_template(template_name, template_json)

    return redirect(request.referrer)


# Blueprint templates
@metadata_schema_editor_bp.route("/metadata-template/delete", methods=["POST"])
@csrf.exempt
def delete_meta_data_template():
    """
    """
    template_name = template_name = request.form["template_name"]
    os.unlink("static/metadata-templates/" + template_name)
    return redirect(request.referrer)
