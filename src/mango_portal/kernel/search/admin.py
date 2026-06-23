from flask import render_template, Blueprint

from . import realm_schemas, realm_schemas_last_update

basic_search_admin_bp = Blueprint("basic_search_admin_bp", __name__, template_folder="templates")

# Are we in a ManGO portal context?
try:
    from mango_portal.mango_ui import register_module_admin

    ADMIN_UI = {
        "title": "Search Schema Cache",
        "bootstrap_icon": "clipboard-data",
        "description": "Search Schema Cache information",
        "blueprint": basic_search_admin_bp.name,
    }
    register_module_admin(**ADMIN_UI)
except Exception as e:
    print(f"Not registering ManGO Flow admin module {__name__}, not in ManGO portal context: {e}")
    pass

@basic_search_admin_bp.route("/search/admin/view/realm_schemas", methods=["GET"])
def index():
    return render_template(
        "search/admin/schema_cache.html.j2",
        realm_schemas=realm_schemas,
        realm_schemas_last_update=realm_schemas_last_update,
    )
