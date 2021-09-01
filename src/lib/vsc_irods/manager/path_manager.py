import os
from vsc_irods.manager import Manager


class PathManager(Manager):
    """ A class dealing with paths on the iRODS file system """
    def __init__(self, session):
        Manager.__init__(self, session)

        # Register the (initial) iRODS current working directory
        try:
            # In case "irods_cwd" was explicitly specified
            # in the irods_environment.json file:
            self._icwd = self.session.pool.account.cwd
        except AttributeError:
            self._icwd = self.get_irods_home()

    def get_irods_home(self):
        """ Returns the path to the iRODS "home" directory,
        which is e.g. used to expand '~/' in search patterns.
        """
        try:
            # In case "irods_home" was explicitly specified
            # in the irods_environment.json file:
            return self.session.pool.account.home
        except AttributeError:
            return os.path.join('/', self.session.pool.account.client_zone,
                                'home', self.session.pool.account.client_user)

    def get_irods_cwd(self):
        """ Returns the current workding directory on iRODS,
        which is e.g. used to expand '.' in search patterns.
        """
        return self._icwd

    def ichdir(self, path, verbose=False):
        """ Changes the current working directory on iRODS.

        Arguments:

        path: str
            The (absolute or relative) path to which the
            iRODS current workding directory for this session
            should be changed.

        verbose: bool (default: False)
            Whether to print more output
        """
        self._icwd = self.get_absolute_irods_path(path)
        self.log('Changed iRODS CWD for this session to: %s' % self._icwd,
                 verbose)

    def get_absolute_irods_path(self, path):
        """ Returns the corresponding absolute path on the iRODS server """
        if path.startswith('/'):
            abs_path = path

        elif path.startswith('~'):
            if path.startswith('~/'):
                abs_path = os.path.join(self.get_irods_home(), path[2:])
            else:
                abs_path = os.path.join(self.get_irods_home(), path[1:])
        else:
            abs_path = os.path.join(self.get_irods_cwd(), path)

        abs_path = os.path.normpath(abs_path)
        return abs_path

    def imkdir(self, path, parents=False, verbose=False, **options):
        """ Creates a collection on the iRODS file system

        Arguments:

        path: str
            The (absolute or relative) collection path to be created

        parents: bool (default: False)
            Whether to also create missing parent collections,
            and not to raise an error when a collection already exists

        verbose: bool (default: False)
            Whether to print more output

        options: (any remaining keywords arguments)
            Additional options to be passed on to PRC's collections.create()
        """
        abs_path = self.get_absolute_irods_path(path)
        already_exists = self.session.collections.exists(abs_path)

        if not parents:
            assert not already_exists, \
                   'Cannot create %s: collection already exists' % abs_path

            dirname = os.path.dirname(abs_path)
            msg = 'Cannot create collection %s because the parent '
            msg += 'colllection does not exist and parents=False'
            assert self.session.collections.exists(dirname), msg % abs_path

        if not already_exists:
            self.log('Creating collection %s' % abs_path, verbose)
            self.session.collections.create(abs_path, recurse=parents,
                                            **options)
