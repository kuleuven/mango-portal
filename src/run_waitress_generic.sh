#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=3000
export spOption="mango_portal"

#export MANGO_AUTH="via_callback"
export MANGO_CONFIG=config_noplugins.py
export MANGO_AUTH=login #localdev
export HOSTNAME

export DEBUG=True
# Enable the Flask debug toolbar by uncommenting the line below
# export FLASK_DEBUG_TOOLBAR=enabled

# Hupper will reload the app upon changed files after 5 secs
hupper --shutdown-interval 5  -m  waitress_serve
