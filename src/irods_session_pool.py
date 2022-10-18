from irods.session import iRODSSession

from threading import Lock, Thread, Event
import datetime, time

class iRODSUSerSession(iRODSSession):

    def __init__(self, irods_session):
        self.irods_session = irods_session
        self.lock = Lock()
        self.created = datetime.datetime.now()
        self.last_accessed = datetime.datetime.now()

    def __del__(self):
        # release connections upon object destruction
        self.irods_session.cleanup()

# global pool of irods session as a dict of wrapped iRODSUSerSession objects
irods_user_sessions = {}

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


TTL = 60 * 30 # 30 minutes
class SessionCleanupThread(Thread):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stop = Event()
    def stop(self):
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

    def run(self):
        current_time = datetime.datetime.now()
        global irods_user_sessions
        while True:
            if self.stopped():
                return
            irods_user_sessions = {k: v for k, v in irods_user_sessions.items() if (current_time - v.last_accessed).total_seconds() < TTL or v.lock.locked()}
            time.sleep(1)


cleanup_old_sessions_thread = SessionCleanupThread()
cleanup_old_sessions_thread.daemon = True

cleanup_old_sessions_thread.start()


# clean_old_sessions_lock = Lock()
# def clean_old_sessions():
#     while True:
#         with clean_old_sessions_lock:
#             current_time = datetime.datetime.now()
#             global irods_user_sessions
#             # clean up inactive old sessions
#             irods_user_sessions = {k: v for k, v in irods_user_sessions.items() if (current_time - v.last_accessed).total_seconds() < TTL or v.lock.locked()}

#         time.sleep(2)


# clean_old_sessions_lock_thread = Thread(target=clean_old_sessions, name='clean-old-irods-sessions', daemon=True)
# clean_old_sessions_lock_thread.start()
