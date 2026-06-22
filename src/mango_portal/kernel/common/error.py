from flask import (
    Blueprint,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_wtf.csrf import CSRFError

error_bp = Blueprint("error_bp", __name__, template_folder="templates/common")


@error_bp.app_errorhandler(CSRFError)
def handle_csrf_error(e):
    flash(
        f"The form you submitted has expired or is invalid: {e}. Please try again.", "danger"
    )
    return redirect(request.referrer or url_for("browse_bp.index"))


@error_bp.app_errorhandler(403)
def error_noaccess(e):
    return render_template("403.html.j2", e=e)


@error_bp.app_errorhandler(404)
def error_notfound(e):
    return render_template("404.html.j2", e=e)


@error_bp.app_errorhandler(413)
def error_request_entity_too_large(e):
    return render_template("413.html.j2", e=e)


@error_bp.app_errorhandler(500)
def error_internalserver(e):
    return render_template("500.html.j2", e=e)


@error_bp.app_errorhandler(503)
def error_internalserver_503(e):
    return render_template("503.html.j2", e=e)


def flash_error(e, category="danger", default_message=None):
    """Handle errors, not always throwing errors.

    Check the type of error and if it matches some condition in a hash and act
    accordingly. In principle, flash a message, but in some cases (like non-existent
    paths) a 404 page may make more sense.

    args:
        e: Error/Exception
        category: A category for the flash message if relevant
        default_message: A message to print if it is not included in the mapping
    """
    e_code = e if type(e) == str else str(e.args[0])
    try:
        flash(current_app.config["MANGO_ERROR_MESSAGES"][e_code], category)
    except KeyError:
        message = (
            f"Unexpected {e=}, {type(e)=}"
            if default_message is None
            else default_message
        )
        flash(message, category)
