from functools import wraps
from flask import g, flash, request, Flask, redirect


def require_mango_portal_admin(func):
    @wraps(func)
    def inner(*args, **kwargs):
        if not hasattr(g, "irods_session"):
            flash("No irods session, magic route", "success")
            return redirect(request.referrer)
        if "mango_portal_admin" not in g.irods_session.roles:
            flash("You are not a portal admin", "danger")
            return redirect(request.referrer)
        # logging.info(f"{g.irods_session.username} is portal admin, all good")
        return func(*args, **kwargs)

    return inner


def init_app(app: Flask):
    """Initialize the admin plugin."""
    from .admin import admin_admin_bp

    app.register_blueprint(admin_admin_bp)
