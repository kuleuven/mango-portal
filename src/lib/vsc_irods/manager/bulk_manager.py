import os
import glob
from irods.column import Criterion
from irods.exception import (CollectionDoesNotExist, OperationNotSupported,
                             MultipleResultsFound)
from irods.keywords import FORCE_FLAG_KW
from irods.meta import iRODSMeta
from irods.models import Collection, DataObject
from vsc_irods.manager import Manager


# Job-related environment variables used by add_job_metadata
job_env_var = ['PBS_O_HOST', 'PBS_JOBID', 'PBS_JOBNAME', 'PBS_NODEFILE',
               'SLURM_SUBMIT_HOST', 'SLURM_JOB_ID', 'SLURM_JOB_NAME',
               'SLURM_JOB_NODELIST']


def confirm(operation, kind, item):
    """ Prompts the users to confirm the given operation """
    answer = None
    while answer not in ['y', 'n']:
        answer = input('OK to %s %s %s? [y/n] ' % (operation, kind, item))
    return answer == 'y'


class BulkManager(Manager):
    """ A class for easier 'bulk' operations with the iRODS file system """

    def remove(self, iterator, recurse=False, force=False, interactive=False,
               verbose=False, **options):
        """ Remove iRODS data objects and/or collections,
        in a manner that resembles the UNIX 'rm' command.

        Examples:

        >>> session.bulk.remove('tmpdir*', recurse=True)
        >>> session.bulk.remove('~/molecule_database/*.xyz')

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Matching data objects
            (and, if used recursively, collections) will be removed.

        recurse: bool (default: False)
            Whether to use recursion, meaning that also matching collections
            and their data objects and subcollections will be removed.

        force: bool (default: False)
            Whether to imediately remove the collections or data objects,
            without putting them in the trash.

        interactive: bool (default: False)
            Whether to prompt for permission before every removal.

        verbose: bool (default: False)
            Whether to print more output.

        options: (any remaining keywords arguments)
            Additional options to be passed on to PRC's
            collections.remove() and data_objects.unlink() methods.
        """
        if isinstance(iterator, str):
            iterator = self.session.search.iglob(iterator)

        for item in iterator:
            path = self.session.path.get_absolute_irods_path(item)

            if self.session.collections.exists(path):
                # Item is a collection, not an object
                if recurse:
                    ok = confirm('remove', 'collection', path) if interactive \
                         else True
                    if ok:
                        self.log('Removing collection %s' % path, verbose)
                        self.session.collections.remove(path, recurse=True,
                                                        force=force, **options)
                else:
                    self.log('Skipping collection %s (no recursion)' % item,
                             verbose)
            else:
                ok = confirm('remove', 'object', path) if interactive else True
                if ok:
                    self.log('Removing object %s' % path, verbose)
                    self.session.data_objects.unlink(path, force=force,
                                                     **options)

    def move(self, iterator, irods_path, clobber=True, interactive=False,
             verbose=False):
        """ Moving or renaming iRODS data objects and/or collections,
        similar to the UNIX `mv` command.

        Raises an CollectionDoesNotExist if the iterator corresponds to more
        than one item and the irods_path destination does not correspond to an
        existing collection.

        Examples:

        >>> session.bulk.move('tmpfiles*', '~/tmpdir/', verbose=True)
        >>> session.bulk.move('./parent/dirname', './parent/dirname_new')

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Matching data objects
            and collections will be moved to the new path.

        irods_path: str (default: '.')
            The (absolute or relative) path on the local file system
            where the data objects and collections will moved to.

        clobber: bool (default: True)
            Whether to overwrite existing data objects.

        interactive: bool (default: False)
            Whether to prompt for permission before overwriting
            existing data objects. If True, the value of the 'clobber'
            argument is ignored.

        verbose: bool (default: False)
            Whether to print more output.
        """
        def move_one(src, dest):
            # Move/renames a single item
            src_abs = self.session.path.get_absolute_irods_path(src)
            dest_abs = self.session.path.get_absolute_irods_path(dest)

            src_is_collection = self.session.collections.exists(src_abs)
            dest_is_object = self.session.data_objects.exists(dest_abs)
            kind = 'collection' if src_is_collection else 'data object'

            ok = True

            if not clobber:
                ok = not dest_is_object

            if interactive:
                ok = confirm('move', kind, src_abs + ' to ' + dest_abs)

            if ok:
                self.log('Moving %s %s to destination %s' % \
                         (kind, src_abs, dest_abs), verbose)

                if src_is_collection:
                    if dest_is_object:
                        msg = 'Cannot overwrite obj %s with coll %s'
                        raise OperationNotSupported(msg % (dest_abs, src_abs))
                    else:
                        self.session.collections.move(src_abs, dest_abs)
                else:
                    self.session.data_objects.move(src_abs, dest_abs)
            else:
                self.log('Skipped moving %s %s to destination %s' % \
                         (kind, src_abs, dest_abs), verbose)


        if isinstance(iterator, str):
            iterator = self.session.search.iglob(iterator)

        try:
            previous_item = next(iterator)
        except StopIteration:
            raise StopIteration('Iterator yields no objects or collections')

        dest = self.session.path.get_absolute_irods_path(irods_path)

        item = None
        for item in iterator:
            # There is more than one item, so irods_path needs
            # to be an existing collection
            if not self.session.collections.exists(dest):
                raise CollectionDoesNotExist(dest)

            move_one(previous_item, dest)
            previous_item = item

        if item is not None:
            move_one(item, dest)
        else:
            # The iterator only held 1 item originally,
            # and it hasn't been processed yet
            move_one(previous_item, dest)

        return

    def get(self, iterator, local_path='.', recurse=False, clobber=True,
            interactive=False, return_data_objects=False, verbose=False,
            **options):
        """ Copy iRODS data objects and/or collections to the local machine.

        Examples:

        >>> session.bulk.get('tmpdir*', recurse=True)
        >>> session.bulk.get('~/irods_db/*.xyz', local_path='./local_db')

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Matching data objects
            (and, if used recursively, collections) will be copied
            to the local machine.

        local_path: str (default: '.')
            The (absolute or relative) path on the local file system
            where the data objects and collections will be copied to.

        recurse: bool (default: False)
            Whether to use recursion, meaning that also matching collections
            and their data objects and subcollections will be copied.

        clobber: bool (default: True)
            Whether to overwrite existing local files.

        interactive: bool (default: False)
            Whether to prompt for permission before overwriting
            existing local files. If True, the value of the 'clobber'
            argument is ignored.

        return_data_objects: (default: False)
            Whether to return a list of iRODSDataObject instances
            of the uploaded data objects, instead of downloading
            them to the local file system. If True, the 'clobber'
            and 'interactive' arguments are ignored.

        verbose: bool (default: False)
            Whether to print more output.

        options: (any remaining keywords arguments)
            Additional options to be passed on to PRC's
            data_objects.get() method.
        """
        if isinstance(iterator, str):
            iterator = self.session.search.iglob(iterator)

        if not return_data_objects and not os.path.isdir(local_path):
            raise OSError('Destination %s does not exist' % local_path)

        objects = []

        for item in iterator:
            path = self.session.path.get_absolute_irods_path(item)

            if self.session.collections.exists(path):
                # Item is a collection, not an object
                if recurse:
                    d = os.path.join(local_path, os.path.basename(item))

                    if not os.path.exists(d) and not return_data_objects:
                        self.log('Creating directory: %s' % d, verbose)
                        os.mkdir(d)

                    self.get(item + '/*', local_path=d, recurse=True,
                             clobber=clobber, interactive=interactive,
                             return_data_objects=return_data_objects,
                             verbose=verbose, **options)
                else:
                    self.log('Skipping collection %s (no recursion)' % item,
                             verbose)
            else:
                if return_data_objects:
                    self.log('Getting object %s' % item, verbose)
                    obj = self.session.data_objects.get(path, file=None,
                                                        **options)
                    objects.append(obj)
                else:
                    name = os.path.basename(path)
                    file_exists = os.path.exists(os.path.join(local_path, name))

                    ok = True

                    if not clobber:
                        ok = not file_exists

                    if interactive:
                        ok = confirm('get', 'object',
                                     path +' to destination ' + local_path)

                    if ok:
                        self.log('Getting object %s to destination %s' % \
                                 (path, local_path), verbose)
                        extra_options = {FORCE_FLAG_KW: ''}
                        obj = self.session.data_objects.get(path,
                                                            file=local_path,
                                                            **extra_options,
                                                            **options)
                    else:
                        self.log('Skipped getting object %s to destination %s' \
                                 % (path, local_path), verbose)

        if return_data_objects:
            return objects

    def put(self, iterator, irods_path='.', recurse=False, clobber=True,
            interactive=False, verbose=False, create_options={}, **options):
        """ Copy local files and/or folders to the iRODS server,
        in a manner that resembles the UNIX 'cp' command.

        Examples:

        >>> session.bulk.put('tmpdir*', recurse=True)
        >>> session.bulk.put('~/local_db/*.xyz', irods_path='./irods_db/')

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            in search_manager.iglob() iterator). Matching files on the
            local machine (and, if used recursively, directories) will
            be copied to the iRODS server.

        irods_path: str (default: '.')
            The (absolute or relative) path on the iRODS file system
            where the local files and folders will be copied to.

        recurse: bool (default: False)
            Whether to use recursion, meaning that also matching folders
            and their files and subfolders will be copied to the iRODS server.

        clobber: bool (default: True)
            Whether to overwrite existing data objects.

        interactive: bool (default: False)
            Whether to prompt for permission before overwriting
            existing data objects. If True, the value of the 'clobber'
            argument is ignored.

        verbose: bool (default: False)
            Whether to print more output.

        create_options: dict (default: {})
            Additional options to be passed on to PRC's
            collections.create() method.

        options: (any remaining keywords arguments)
            Additional options to be passed on to PRC's
            data_objects.put() method.
        """
        if type(iterator) is str:
            iterator = glob.iglob(iterator)

        dest = self.session.path.get_absolute_irods_path(irods_path)

        if not self.session.collections.exists(dest):
            raise CollectionDoesNotExist(dest)

        for item in iterator:
            local_path = item.rstrip('/')
            path = os.path.join(dest, os.path.basename(local_path))

            if os.path.isdir(local_path):
                if recurse:
                    if not self.session.collections.exists(path):
                        self.log('Creating collection: %s' % path, verbose)
                        self.session.collections.create(path, recurse=True,
                                                        **create_options)

                    self.put(local_path + '/*', irods_path=path, recurse=True,
                             clobber=clobber, interactive=interactive,
                             create_options=create_options, verbose=verbose,
                             **options)
                else:
                    self.log('Skipping collection %s (no recursion)' % \
                             local_path, verbose)

            elif os.path.isfile(local_path):
                object_exists = self.session.data_objects.exists(path)

                ok = True

                if not clobber:
                    ok = not object_exists

                if interactive:
                    ok = confirm('put', 'file',
                                 local_path +' in collection ' + dest)

                if ok:
                    self.log('Putting file %s in collection %s' % \
                             (local_path, dest), verbose)
                    self.session.data_objects.put(local_path, dest + '/',
                                                  **options)
                else:
                    self.log('Skipped putting file %s in collection %s' % \
                             (local_path, dest), verbose)


    def metadata(self, iterator, action='add', recurse=False, collection_avu=[],
                 object_avu=[], verbose=False):
        """ Add or remove metadata to iRODS data objects and/or collections.

        Examples:

        >>> session.bulk.metadata('tmpdir*', action='add', recurse=True,
                                   object_avu=('is_temporary_file',)),
                                   collection_avu=('is_temporary_dir',))

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Metadata will be modified for
            matching data objects and, if used recursively, collections.

        action: str
            The action to perform. Choose either 'add' or 'remove'.

        recurse: bool (default: False)
            Whether to use recursion, meaning that metadata will be
            modified for matching collections and their data objects
            and subcollections.

        collection_avu: tuple or list of tuples (default: [])
            One or several attribute-value[-unit]] tuples to be modified
            for collections.

        object_avu: tuple or list of tuples (default: [])
            One or several attribute-value[-unit]] tuples to be modified
            for data objects.

        verbose: bool (default: False)
            Whether to print more output.
        """
        if isinstance(iterator, str):
            iterator = self.session.search.iglob(iterator)

        if action not in ['add', 'remove']:
            raise OperationNotSupported('Unknown action "%s"' % action)

        if action == 'add':
            log_msg = 'Adding metadata {avu} to {kind} {path}'
        else:
            log_msg = 'Removing metadata {avu} from {kind} {path}'

        if isinstance(object_avu, tuple): object_avu = [object_avu]
        if isinstance(collection_avu, tuple): collection_avu = [collection_avu]

        for item in iterator:
            path = self.session.path.get_absolute_irods_path(item)

            if self.session.collections.exists(path):
                # Item is a collection, not an object
                kind = 'collection'

                if recurse:
                    for avu in collection_avu:
                        self.log(log_msg.format(avu=avu, kind=kind, path=path),
                                 verbose)

                        meta = iRODSMeta(*avu)
                        if action == 'add':
                            self.session.metadata.set(Collection, path, meta)
                        elif action == 'remove':
                            self.session.metadata.remove(Collection, path, meta)

                    self.metadata(item + '/*', action, recurse=True,
                                  collection_avu=collection_avu,
                                  object_avu=object_avu,
                                  verbose=verbose)
                else:
                    self.log('Skipping collection %s (no recursion)' % item,
                             verbose)
            else:
                kind = 'data object'

                for avu in object_avu:
                    self.log(log_msg.format(avu=str(avu), kind=kind, path=path),
                             verbose)

                    meta = iRODSMeta(*avu)
                    if action == 'add':
                        self.session.metadata.set(DataObject, path, meta)
                    elif action == 'remove':
                        self.session.metadata.remove(DataObject, path, meta)

    def add_job_metadata(self, iterator, recurse=False, verbose=False):
        """ Add job-related metadata to selected data objects and collections.

        Examples:

        >>> session.bulk.add_job_metadata('~/data/out*.txt')

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Job metadata will be added for
            matching data objects and, if used recursively, collections.

        recurse: bool (default: False)
            Whether to use recursion, meaning that job metadata will be
            added to matching collections and their data objects and
            subcollections.

        verbose: bool (default: False)
            Whether to print more output.
        """
        # Gather job-related information from available environment variables
        avus = []
        for key in job_env_var:
            if key in os.environ:
                if key.endswith('FILE'):
                    # e.g. $PBS_NODEFILE is special, as it refers to a file
                    with open(os.environ[key], 'r') as f:
                        value = ','.join([line.strip() for line in f])

                    listkey = key.replace('FILE', 'LIST')
                    avus.append((listkey, value))
                else:
                    avus.append((key, os.environ[key]))

        self.metadata(iterator, action='add',
                      collection_avu=avus,
                      object_avu=avus,
                      recurse=recurse,
                      verbose=verbose)

    def size(self, iterator, recurse=False, verbose=False):
        """ Yields (path, size-in-bytes) tuples for the selected data
        objects and collections.

        Examples:

        >>> session.bulk.size('~/data/out*.txt')
        >>> session.bulk.size('./data', recurse=True)

        Arguments:

        iterator: iterator or str
            Defines which items are subject to the bulk operation.
            Can be an iterator (e.g. using search_manager.find())
            or a string (which will be used to construct a
            search_manager.iglob() iterator). Data sizes will be returned
            for matching data objects and, if used recursively, collections.

        recurse: bool (default: False)
            Whether to use recursion, meaning that the data size of
            matching collections will be calculated as the sum of
            their data objects and subcollection sizes.

        verbose: bool (default: False)
            Whether to print more output.
        """
        if isinstance(iterator, str):
            iterator = self.session.search.iglob(iterator)

        for item in iterator:
            path = self.session.path.get_absolute_irods_path(item)

            if self.session.collections.exists(path):
                if recurse:
                    new_iterator = self.size(item + '/*', recurse=True,
                                             verbose=verbose)
                    size = sum([result[1] for result in new_iterator])
                else:
                    self.log('Skipping collection %s (no recursion)' % item,
                             verbose)
                    continue
            else:
                dirname = os.path.dirname(path)
                basename = os.path.basename(path)
                criteria = [Criterion('=', Collection.name, dirname),
                            Criterion('=', DataObject.name, basename)]
                fields = [DataObject.size]
                q = self.session.query(*fields).filter(*criteria)

                results = [result for result in q.get_results()]
                if len(results) > 1:
                    raise MultipleResultsFound('Different replicas of data ' + \
                                        'object %s have different sizes' % path)

                size = results[0][DataObject.size]

            yield (item, size)
