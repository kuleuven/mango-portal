from flask import render_template

from . import basic_search_bp, realm_schemas, realm_schemas_last_update

# Are we in a ManGO portal context?
try:
    from mango_ui import register_module_admin

    ADMIN_UI = {
        "title": "Search Schema Cache",
        "bootstrap_icon": "diagram-3",
        "description": "Search Schema Cache information",
        "blueprint": basic_search_bp,
    }
    register_module_admin(**ADMIN_UI)
except Exception as e:
    print(f"Not registering ManGO Flow admin module, not in ManGO portal context: {e}")
    pass

@basic_search_bp.route("/search/admin/view/realm_schemas", methods=["GET"])
def index():
    return render_template(
        "search/admin/schema_cache.html.j2",
        realm_schemas=realm_schemas,
        realm_schemas_last_update=realm_schemas_last_update,
    )
