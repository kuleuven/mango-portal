import os, logging
import plugins.operator as operator

def get_operator_session(zone):
    return operator.get_zone_operator_session(zone)


