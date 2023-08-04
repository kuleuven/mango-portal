from flask import render_template, Blueprint, g, session, request, jsonify, redirect
from irods.session import iRODSSession

user_tantra_realm_bp = Blueprint(
    "user_tantra_realm_bp", __name__, template_folder="templates"
)


# No route declaration here, its meant to go through a config option and call it dynamically for KULeuven installations
def index():
    irods_session: iRODSSession = g.irods_session
    # projects = irods_session.query()
    realm_collections = irods_session.collections.get(f"/{irods_session.zone}/home").subcollections

    realm = get_realm(g.irods_session)
    if realm not in [coll.name for coll in realm_collections]:
        realm = None
        set_realm(g.irods_session)

    return render_template(
        "user_tantra/index.html.j2", realm_collections=realm_collections, realm = realm
    )


def get_realm(irods_session: iRODSSession):
    return getattr(irods_session, "realm", None)


def set_realm(irods_session, realm=None):
    if not realm:
        if getattr(irods_session, "realm", None):
            delattr(irods_session, "realm")
    else:
        setattr(irods_session, "realm", realm)

 
@user_tantra_realm_bp.route(
    "/user_tantra/realm",
    methods=[
        "GET",
        "POST",
    ],
)
def handle_realm():
    if request.method == "POST":
        if request.values.get("operation") == "DELETE":
            set_realm(g.irods_session, None)
            session.pop("realm", None)
        else:
            if request.values.get("realm_name", None) and request.values.get(
                "realm_path", None
            ):
                realm = {
                    "name": request.values.get("realm_name"),
                    "path": request.values.get("realm_path"),
                }
                set_realm(g.irods_session, realm)
                session.setdefault("realm", realm)
                
    if request.method == "GET":
        return jsonify(get_realm(g.irods_session))
    
    if "redirect_route" in request.values:
        return redirect(request.values["redirect_route"])
    if "redirect_hash" in request.values:
        return redirect(
            request.referrer.split("#")[0] + request.values["redirect_hash"]
        )
    return redirect(request.referrer)
