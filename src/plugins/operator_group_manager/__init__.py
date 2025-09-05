import plugins.operator as operator
import signals

##  signals to be used in dedicated pub/sub actions for the operator group manager
yaml_definition_uploaded = signals.mango_signals.signal("yaml_definition_uploaded")
# broad signal to be typically used in cache refreshes: created, updated, deleted
group_definition_cud = signals.mango_signals.signal("group_definition_cud")


def get_operator_session(zone):
    return operator.get_zone_operator_session(zone)


def handle_yaml_listener(sender, irods_session, yaml_path, **kwargs):
    # todo: call mango flow task. But that code should eventually be moved outside this
    # plugin and be called via config
    pass

yaml_definition_uploaded.connect(handle_yaml_listener)