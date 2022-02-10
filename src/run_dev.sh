#!/bin/bash


cd `dirname "$0"`

echo "Starting development instance from directory $(dirname $0)"

export FLASK_APP=app.py
# development mode for hot reloading changed files
export FLASK_ENV=development

flask run
