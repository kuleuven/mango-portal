#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=8080
export spOption="mango_portal"
export HOSTNAME
# development mode for hot reloading changed files
# export FLASK_DEBUG=True
hupper --shutdown-interval 5  -m  waitress_serve
