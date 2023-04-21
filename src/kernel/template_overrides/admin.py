from flask import (
    Blueprint,
    render_template,
    current_app,
    url_for,
    redirect,
    g,
    request,
)

from . import (
    template_override_managers,
    TemplateOverrideManager,
    get_template_override_manager,
)

from mango_ui import register_module_admin

template_overrides_admin_bp = Blueprint(
    "template_overrides_admin_bp", __name__, template_folder="templates"
)


ADMIN_UI = {
    "title": "Template overrides",
    "bootstrap_icon": "window-stack",
    "description": "Template overrides inspection tool",
    "index": "index",
    "blueprint": "template_overrides_admin_bp",
}

register_module_admin(**ADMIN_UI)


@template_overrides_admin_bp.route("/template_overrides/admin")
def index():
    template_override_manager = get_template_override_manager(g.irods_session.zone)
    source = request.values.get("source", "")
    return render_template(
        "template_overrides/admin_index.html.j2",
        template_override_manager=template_override_manager,
        source=source,
    )


# @Blueprint.app_template_filter(name="")
