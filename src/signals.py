from blinker import Namespace

mango_signals = Namespace()

collection_changed = mango_signals.signal('collection_changed')

collection_added = mango_signals.signal('collection_added')
subtree_added = mango_signals.signal('subtree_added') # multiple collections at once, with for example a '/' in the name
collection_trashed = mango_signals.signal('collection_trashed')
collection_deleted = mango_signals.signal('collection_deleted')
collection_moved = mango_signals.signal('collection_moved')
collection_copied = mango_signals.signal('collection_copied')
collection_renamed = mango_signals.signal('collection_renamed')

data_object_changed = mango_signals.signal('data_object_changed')
data_object_added = mango_signals.signal('data_object_changed')
data_object_trashed = mango_signals.signal('data_object_trashed')
data_object_deleted = mango_signals.signal('data_object_deleted')
data_object_moved = mango_signals.signal('data_object_moved')
data_object_copied = mango_signals.signal('data_object_copied')
data_object_renamed = mango_signals.signal('data_object_renamed')

metadata_changed = mango_signals.signal('metadata_changed')
metadata_deleted = mango_signals.signal('metadata_deleted')

permissions_changed = mango_signals.signal('permissions_changed')

session_pool_user_session_created = mango_signals.signal('user_session_created')
