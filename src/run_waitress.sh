#!/bin/bash


cd `dirname "$0"`

echo "Starting instance from directory $(dirname $0)"

export SERVICE_PORT=8080
export spOption="Mango_portal_waitress"
# development mode for hot reloading changed files
# export FLASK_DEBUG=True
python waitress_serve.py&
