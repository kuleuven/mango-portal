from flask import Blueprint, render_template, url_for, redirect

error_bp = Blueprint('error_bp', __name__,  template_folder='templates/common')


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