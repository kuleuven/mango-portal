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

template_overrides_admin_bp = Blueprint(
    "template_overrides_admin_bp", __name__, template_folder="templates"
)

ADMIN_LABEL = "Template overrides inspection tool"
ADMIN_SHORT_NAME = "Template overrides"
ADMIN_BOOTSTRAP_ICON = "window-stack"


@template_overrides_admin_bp.route("/template_overrides/admin")
def index():
    template_override_manager = get_template_override_manager(g.irods_session.zone)
    source = request.values.get("source", "")
    return render_template(
        "template_overrides/admin_index.html.j2",
        template_override_manager=template_override_manager,
        source=source,
    )
