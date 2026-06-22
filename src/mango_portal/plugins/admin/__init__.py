from functools import wraps
from flask import g, flash, request, redirect
from irods_session_pool import get_irods_session
import logging


def require_mango_portal_admin(func):
    @wraps(func)
    def inner(*args, **kwargs):
        if not hasattr(g,"irods_session"):
            flash("No irods session, magic route", "success")
            return redirect(request.referrer)
        if not "mango_portal_admin" in g.irods_session.roles:
            flash("You are not a portal admin", "danger")
            return redirect(request.referrer)
        # logging.info(f"{g.irods_session.username} is portal admin, all good")
        return func(*args, **kwargs)

    return inner
