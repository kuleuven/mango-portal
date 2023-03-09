#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=8080
export spOption="mango_portal"

#export MANGO_AUTH="via_callback"
export MANGO_AUTH=localdev
export HOSTNAME
# Hupper will reload the app upon changed files after 5 secs
hupper --shutdown-interval 5  -m  waitress_serve
