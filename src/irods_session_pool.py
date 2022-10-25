from irods.session import iRODSSession

from threading import Lock, Thread, Event
import datetime, time
import logging

# global pool of irods session as a dict of wrapped iRODSUSerSession objects
irods_user_sessions = {}
SESSION_TTL = 60 * 30 # 30 minutes
class iRODSUSerSession(iRODSSession):

    def __init__(self, irods_session: iRODSSession):
        self.irods_session = irods_session
        self.lock = Lock()
        self.created = datetime.datetime.now()
        self.last_accessed = datetime.datetime.now()

    def __del__(self):
        # release connections upon object destruction
        logging.info(f"Session {self.irods_session.username} going away, bye!")
        self.irods_session.cleanup()



class SessionCleanupThread(Thread):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop = Event()
        self.daemon = True
        self.start_time=datetime.datetime.now()
    def stop(self):
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

    def run(self):

        global irods_user_sessions
        while True:
            if self.stopped():
                return

            current_time = datetime.datetime.now()
            irods_user_sessions = {session_id: user_session for session_id, user_session in irods_user_sessions.items()
                if (current_time - user_session.last_accessed).total_seconds() < SESSION_TTL or user_session.lock.locked()}

            # for session_id, user_session in irods_user_sessions.items():
            #     session_age = (current_time - user_session.last_accessed).total_seconds()
            #     logging.info(f"Inspecting for {session_id}: age={session_age}, lock state={user_session.lock.locked()}")
            #     if session_age > SESSION_TTL and not user_session.lock.locked():
            #         del irods_user_sessions[session_id]
            #         logging.info(f"Removed {session_id}")
            time.sleep(1)
            # emit a heartbeat logging at most every 30 seconds
            if int(time.time()) % 30 == 0:
                logging.info(f"Cleanup heartbeat")



def add_irods_session(session_id, irods_session):
    global irods_user_sessions
    irods_user_sessions[session_id] = iRODSUSerSession(irods_session)
    irods_user_sessions[session_id].lock.acquire()


def get_irods_session(session_id):
    global irods_user_sessions
    if session_id in irods_user_sessions:
        irods_user_sessions[session_id].lock.acquire()
        irods_user_sessions[session_id].last_accessed=datetime.datetime.now()
        return irods_user_sessions[session_id].irods_session
    else:
        return None

def unlock_irods_session(session_id):
    global irods_user_sessions
    if session_id in irods_user_sessions and  irods_user_sessions[session_id].lock.locked():
        irods_user_sessions[session_id].lock.release()

def remove_irods_session(session_id):
    if session_id in irods_user_sessions:
        del irods_user_sessions[session_id]

def check_and_restart_cleanup():
    global cleanup_old_sessions_thread
    cleanup_old_sessions_thread.join(0.0)
    if not cleanup_old_sessions_thread.is_alive():
        logging.info('Session cleanup: started a new thread since the daemon died')
        cleanup_old_sessions_thread = SessionCleanupThread()
        cleanup_old_sessions_thread.start()

cleanup_old_sessions_thread = SessionCleanupThread()
cleanup_old_sessions_thread.start()
