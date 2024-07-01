from flask import Blueprint, render_template, url_for, redirect, current_app, flash

error_bp = Blueprint("error_bp", __name__, template_folder="templates/common")


@error_bp.app_errorhandler(403)
def error_noaccess(e):
    return render_template("403.html.j2", e=e)


@error_bp.app_errorhandler(404)
def error_notfound(e):
    return render_template("404.html.j2", e=e)


@error_bp.app_errorhandler(500)
def error_internalserver(e):
    return render_template("500.html.j2", e=e)


@error_bp.app_errorhandler(503)
def error_internalserver(e):
    return render_template("503.html.j2", e=e)


def flash_error(e, category="error", default_message=None):
    """Handle errors, not always throwing errors.

    Check the type of error and if it matches some condition in a hash and act
    accordingly. In principle, flash a message, but in some cases (like non-existent
    paths) a 404 page may make more sense.

    args:
        e: Error/Exception
        category: A category for the flash message if relevant
        default_message: A message to print if it is not included in the mapping
    """
    # TODO add logic for different kinds of errors
    for mapping in current_app.config["MANGO_ERROR_MESSAGES"]:
        if e.args[0] == mapping["args"][0]:
            flash(mapping["text"], category)
            break
    message = (
        f"Unexpected {e=}, {type(e)=}" if default_message is None else default_message
    )
    flash(message, category)
