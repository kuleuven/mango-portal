import os
import sys
import ssl
from irods.session import iRODSSession
from vsc_irods.manager.path_manager import PathManager
from vsc_irods.manager.search_manager import SearchManager
from vsc_irods.manager.bulk_manager import BulkManager


class VSCiRODSSession(iRODSSession):
    """ An extension to the iRODSSession class from python-irodsclient

    The main goal is to make it easy to get/put/move/delete/...
    sets of data objects and collections within a Python script
    or a shell session.

    Example:

    >>> with VSCiRODSSession() as session:
    >>>    session.bulk.get('~/my_irods_collection/*.txt', local_path='.')

    .. note::

    	The initial iRODS current working directory is set
    	to the user's iRODS "home" directory
    	(see :func:`vsc_irods.manager.path_manager.PathManager.get_irods_home`)
    	This can be changed with
        :func:`vsc_irods.manager.path_manager.PathManager.ichdir`.

    Arguments:

    txt: None or str (default: '-')
    	Where output should be printed
        Use '-' for stdout, None for /dev/null,
        any other string for a text file, or a file handle
    """

    def __init__(self, txt="-", **kwargs):
        try:
            env_file = os.environ["IRODS_ENVIRONMENT_FILE"]
        except KeyError:
            env_file = os.path.expanduser("~/.irods/irods_environment.json")

        ssl_context = ssl.create_default_context(
            purpose=ssl.Purpose.SERVER_AUTH, cafile=None, capath=None, cadata=None
        )
        ssl_settings = {"ssl_context": ssl_context}

        iRODSSession.__init__(self, irods_env_file=env_file, **ssl_settings, **kwargs)

        self.set_log_output(txt)
        self.path = PathManager(self)
        self.search = SearchManager(self)
        self.bulk = BulkManager(self)

    def set_log_output(self, txt):
        """ Sets where the log should be printed """
        if txt is None:
            self.txt = open(os.devnull, "w")
        elif isinstance(txt, str):
            if txt == "-":
                self.txt = sys.stdout
            else:
                self.txt = open(txt, "a")
        else:
            self.txt = txt

    def log(self, line, flag, **kwargs):
        """ Prints line to output if flag is True """
        if flag:
            print(line, file=self.txt, **kwargs)
