import os
import fnmatch
import warnings
import itertools
from irods.column import Criterion
from irods.models import Collection, CollectionMeta, DataObject, DataObjectMeta
from vsc_irods.manager import Manager


class SearchManager(Manager):
    """ A class for easier searching in the iRODS file system """
    def glob(self, *args, debug=False):
        """ As iglob(), but returns a list instead of an iterator,
        similar to the glob.iglob builtin.

        Arguments:

        args: one or more str
            The search patterns

        debug: bool (default: False)
            Set to True for debugging info
        """
        results = [hit for hit in self.iglob(*args, debug=debug)]

        self.log('DBG| returning %s' % str(results), debug)
        return results

    def iglob(self, pattern, debug=False):
        """ Returns an iterator of iRODS collection and data object paths
        which match the given pattern, similar to the glob.iglob builtin.

        .. note::
 
            Currently only '*' is expanded. The other special characters
            '?' and '[]' are not (yet) taken into account.

        Examples:

        >>> session.glob('m*/ch4.xyz')
            ['molecules_database/ch4.xyz']
        >>> session.glob('./*/*')
            ['./molecule_database/a.out', './foo/bar.so']
        >>> session.glob('~/foo/c*.xyz')
            ['~/foo/ch4.xyz', '~/foo/co2.xyz']

        Arguments:

        pattern: str
            The search pattern

        debug: bool (default: False)
            Set to True for debugging info
        """
        self.log('DBG| search.iglob pattern: %s' % pattern, debug)

        if '*' in pattern:
            index = pattern.index('*')
            path_root = os.path.dirname(pattern[:index])
        else:
            path_root = pattern

        path_root = path_root.rstrip('/') if path_root else '.'
        path_root_abs = self.session.path.get_absolute_irods_path(path_root)

        # First, the collections
        pattern_collection = self.session.path.get_absolute_irods_path(pattern)
        pattern_collection = pattern_collection.replace('*', '%')
        self.log('DBG| search.iglob pattern_collection: %s' % \
                 pattern_collection, debug)

        fields = [Collection.name]
        criteria = [Criterion('like',  Collection.name, pattern_collection),
                    Criterion('not like',  Collection.name,
                              pattern_collection + '/%')]
        q = self.session.query(*fields).filter(*criteria)

        for result in q.get_results():
            path = result[Collection.name].replace(path_root_abs, path_root, 1)
            yield path

        # Next, the data objects
        pattern_collection = os.path.dirname(pattern_collection)
        pattern_object = os.path.basename(pattern)
        pattern_object = pattern_object.replace('*', '%')
        self.log('DBG| search.iglob pattern_object: %s' % pattern_object, debug)

        fields = [Collection.name, DataObject.name]
        criteria = [Criterion('like',  Collection.name, pattern_collection),
                    Criterion('not like',  Collection.name,
                              pattern_collection + '/%'),
                    Criterion('like',  DataObject.name, pattern_object)]

        q = self.session.query(*fields).filter(*criteria)

        for result in q.get_results():
            path = os.path.join(result[Collection.name],
                                result[DataObject.name])
            path = path.replace(path_root_abs, path_root, 1)
            yield path

    def walk(self, collection, mindepth=0, maxdepth=-1, return_objects=False,
             debug=False):
        """
        Top-down collection tree generator, yielding 3-tuples of
        (collection, [list of subcollections], [list of data objects]).

        Only those tuples are returned for which the subcollections
        and data objects are within the selected depth range.

        Arguments:

        collection: str or iRODSCollection instance
            The root of the collection tree in which to search

        mindepth: int (default: 0)
            Minimal depth with respect to the root collections

        maxdepth: int (default: -1)
            Maximal depth with respect to the root collections

        return_objects: bool (default: True)
            Whether to return path strings or the corresponding objects
            (iRODSCollection and iRODSDataObject instances)

        debug: bool (default: False)
            Set to True for debugging info

        """
        assert mindepth >= 0

        if maxdepth == -1 or maxdepth >= mindepth:
            if isinstance(collection, str):
                abs_path = self.session.path.get_absolute_irods_path(collection)
                collection = self.session.collections.get(abs_path)

            if mindepth <= 1 and maxdepth != 0:
                if return_objects:
                    yield (collection,
                           collection.subcollections,
                           collection.data_objects)
                else:
                    yield (collection.path,
                           [subcollection.path
                            for subcollection in collection.subcollections],
                           [data_object.path
                            for data_object in collection.data_objects])

            if maxdepth != 0:
                for subcollection in collection.subcollections:
                    self.log('DBG| search.walk recursing subcollection: %s'
                             % subcollection.path, debug)

                    new_mindepth = max(0, mindepth - 1)
                    new_maxdepth = max(-1, maxdepth - 1)
                    yield from self.walk(subcollection,
                                         mindepth=new_mindepth,
                                         maxdepth=new_maxdepth,
                                         return_objects=return_objects)

    def find(self, irods_path='.', pattern='*', use_wholename=False,
             types='d,f', mindepth=0, maxdepth=-1, collection_avu=[],
             object_avu=[], debug=False):
        """ Returns a list of iRODS collection and data object paths
        which match the given pattern, similar to the UNIX `find` command.

        Examples:

        >>> session.find('.', pattern='*mol*/*.xyz', types='f',
        >>>              object_avu=('=,kind', 'like,%organic'))
            ['data/molecules/c6h6.xyz', './data/molecules/ch3cooh.xyz']
        >>> session.find('~/data*', pattern='molecules', types='d')
            ['~/data/molecules']

        Arguments:

        irods_path: str (default: '.')
            Glob pattern of the roots of the iRODS collection trees
            in which to search

        pattern: str (default: '*')
            The search pattern

        use_wholename: bool (default: False)
            Whether it is the whole (absolute) path name that has to
            match the pattern, or only the basename of the collection
            or data object.

        types: str (default: 'd,f')
            Comma-separated list of one or more of the following characters
            to select the type of results to include:

            * 'd' for directories (i.e. collections)
            * 'f' for files (i.e. data objects)

        mindepth: int (default: 0)
            Minimal depth with respect to the root collections

        maxdepth: int (default: -1)
            Maximal depth with respect to the root collections

        collection_avu: tuple or list of tuples (default: [])
            One or several attribute[-value[-unit]] patterns to be used
            in filtering collections.

        object_avu: tuple or list of tuples (default: [])
            One or several attribute[-value[-unit]] patterns to be used
            in filtering data objects.

        debug: bool (default: False)
            Set to True for debugging info
        """
        # Process arguments:
        assert mindepth >= 0, 'mindepth argument must be >= 0'
        if isinstance(object_avu, tuple): object_avu = [object_avu]
        if isinstance(collection_avu, tuple): collection_avu = [collection_avu]

        if not use_wholename and '/' in pattern:
            msg = "Pattern %s contains a slash. UNIX file names usually don't, "
            msg += "so this search will probably yield no results. Setting "
            msg += "'wholename=True' may help you find what you're looking for."
            warnings.warn(msg % pattern)

        # Set up the metadata fields and criteria for the queries:
        def parse_avu_component(component):
            if component.count(',') == 0:
                operation, meta_pattern = '=', component
            elif component.count(',') == 1:
                operation, meta_pattern = component.split(',')
            else:
                raise ValueError('Cannot parse AVU component: %s' % component)
            return operation, meta_pattern

        meta_fields = {Collection: [], DataObject: []}
        meta_criteria = {Collection: [], DataObject: []}

        for model, avu_list in zip([Collection, DataObject],
                                   [collection_avu, object_avu]):
            for avu in avu_list:
                if model == Collection:
                    fields = [CollectionMeta.name, CollectionMeta.value,
                              CollectionMeta.units]
                elif model == DataObject:
                    fields = [DataObjectMeta.name, DataObjectMeta.value,
                              DataObjectMeta.units]

                for item, field in zip(avu, fields):
                    operation, meta_pattern = parse_avu_component(item)
                    self.log('DBG| AVU criterion: %s %s %s' % \
                             (operation, field, meta_pattern), debug)
                    criterion = Criterion(operation, field, meta_pattern)
                    meta_criteria[model].append(criterion)
                    meta_fields[model].append(field)

        # Loop over the glob-pattern-matching collections and data objects
        for path_root in self.iglob(irods_path, debug=debug):
            self.log('DBG| search.find path_root: %s' % path_root, debug)
            path_root_abs = self.session.path.get_absolute_irods_path(path_root)

            if not self.session.collections.exists(path_root_abs):
                if 'f' in types.split(','):
                    yield path_root
                continue

            # Walk the collection trees
            iterators = [self.walk(path_root, mindepth=mindepth,
                                   maxdepth=maxdepth, return_objects=True,
                                   debug=debug)]
            if mindepth == 0:
                # Also include the root collection,
                # which is not covered by self.walk
                collection = self.session.collections.get(path_root_abs)
                iterators.insert(0, [(collection, [collection], [])])

            iterator = itertools.chain(*iterators)

            for (collection, subcollections, data_objects) in iterator:
                self.log('DBG| search.find collection: %s' % collection.path,
                         debug)
                # Now we are left with collections and data objects
                # which match the depths and the given 'irods_path'
                # glob pattern, and we just need to further filter
                # on the (whole)name pattern and the AVUs.

                # Things to keep in mind:
                # * Collection: 'name' attribute refers to full path
                #               'path' attribute non-existent
                # * DataObject: 'name' attribute refers to basename
                #               'path' attribute non-existent
                # * iRODSCollection and iRODSDataObject:
                #               'name' refers to basename,
                #               'path' referse to full path

                for t, items in zip(['d', 'f'], [subcollections, data_objects]):
                    if t not in types.split(','):
                        continue

                    for item in items:
                        name = item.path if use_wholename else item.name
                        if not fnmatch.fnmatch(name, pattern):
                            continue

                        if t == 'd':
                            q = self.session.query(Collection.name,
                                                   *meta_fields[Collection])
                            criterion = Criterion('=',  Collection.name,
                                                  item.path)
                            q = q.filter(criterion, *meta_criteria[Collection])

                        elif t == 'f':
                            q = self.session.query(Collection.name,
                                                   DataObject.name,
                                                   *meta_fields[DataObject])
                            criteria = [Criterion('=',  Collection.name,
                                                  collection.path),
                                        Criterion('=',  DataObject.name,
                                                  item.name)]
                            q = q.filter(*criteria, *meta_criteria[DataObject])

                        results = [result for result in q.get_results()]
                        assert len(results) in [0, 1], results

                        if len(results) == 1:
                            path = item.path.replace(path_root_abs,
                                                     path_root.rstrip('/'), 1)
                            yield path
