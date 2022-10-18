# -*- coding: utf-8 -*-

from waitress import serve
import app
import os
import logging
import signal
import time
import sys
from waitress.server import create_server
import irods_session_pool

if __name__ == '__main__':

    # register a shutdown function
    def handle_sig(sig, frame):
        logging.warning(f"Got signal {sig}, start shutdown of mango server...")
        # stop cleaning old sessions
        logging.warning(f"Stopping cleanup thread ...")
        irods_session_pool.cleanup_old_sessions_thread.stop()
        # wait for thethread to be stopped, it runs in a sleep(1) infinite loop
        time.sleep(2)
        #irods_session_pool.cleanup_old_sessions_thread.join()
        #time.sleep(1)
        # close all sessions
        logging.warning("Removing sessions")
        for session_id in list(irods_session_pool.irods_user_sessions):
            irods_session_pool.remove_irods_session(session_id)
            logging.warning(f"Removed sesssion {session_id}")

        server.close()

    for sig in (signal.SIGTERM, signal.SIGQUIT, signal.SIGHUP):
        signal.signal(sig, handle_sig)

    logger = logging.getLogger("waitress")
    logger.setLevel(logging.INFO)
    service_port = str(os.environ.get("SERVICE_PORT", 80))

    server = create_server(app.app, host="*", port=service_port, threads=12)
    server.run()
