from blinker import Namespace

mango_signals = Namespace()

collection_changed = mango_signals.signal('collection_changed')
data_object_changed = mango_signals.signal('data_object_changed')

collection_added = mango_signals.signal('collection_added')
data_object_added = mango_signals.signal('data_object_changed')

collection_trashed = mango_signals.signal('collection_trashed')
collection_deleted = mango_signals.signal('collection_deleted')

data_object_trashed = mango_signals.signal('data_object_trashed')
data_object_deleted = mango_signals.signal('data_object_deleted')

metadata_changed = mango_signals.signal('metadata_changed')
metadata_deleted = mango_signals.signal('metadata_deleted')

