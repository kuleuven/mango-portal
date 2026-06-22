# This module is simply to void circular references with Flask blueprints

from flask_caching import Cache

cache = Cache()
