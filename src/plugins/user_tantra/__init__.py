from flask import session

import irods_session_pool, signals
import json, logging
from app import app, irods_sessions
from plugins.operator import get_zone_operator_session

# catch signal from user login sessions to
# attach the mango_admin group
# to insert/update name/email from openid session


def enrich_irods_session_listener(sender, **parameters):
    # logging.info(f"Starting enrichment listener procedure, did nothing yet")
    if irods_session_pool.has_irods_session(parameters["username"]):
        # logging.info(f"Starting enrichment listener procedure if is true")
        mango_irods_session = irods_session_pool.get_irods_session(
            parameters["username"]
        )

        mango_admins = app.config.get("MANGO_ADMINS", [])
        if parameters["username"] in mango_admins:
            if hasattr(mango_irods_session, "roles"):
                mango_irods_session.roles.append("mango_portal_admin")
            else:
                mango_irods_session.roles = ["mango_portal_admin"]
            logging.info(f"User has role portal admin")

        zone_operator = get_zone_operator_session(parameters["zone"])
        user_object = zone_operator.users.get(parameters["username"])
        # see if we can find the user name and email in the irods_session to set as metadata, but only in the case of not impersonating
        if (
            getattr(mango_irods_session, "openid_user_name", "").find("impersonating")
            == -1
        ):
            for openid_attr, user_meta in {
                "openid_user_name": "name",
                "openid_user_email": "email",
            }.items():
                if hasattr(mango_irods_session, openid_attr):
                    user_has_attr = False
                    for avu in user_object.metadata.items():
                        if avu.name == user_meta:
                            user_has_attr = True
                            logging.info(
                                f"Existing {user_meta}: {avu.name} = {avu.value}"
                            )
                            break
                    if not user_has_attr:
                        logging.info(
                            f"Setting extra metadata for user {parameters['username']}: {user_meta} = {getattr(mango_irods_session, openid_attr)}"
                        )
                        user_object.metadata.add(
                            user_meta, getattr(mango_irods_session, openid_attr)
                        )
                else:
                    logging.info(f"No openid data found: {openid_attr}")

            logging.info(f"Enriched user session for {parameters['username']}")
    else:
        logging.info(
            f"No session found for user {parameters['username']}, this should not happen"
        )


signals.session_pool_user_session_created.connect(enrich_irods_session_listener)
