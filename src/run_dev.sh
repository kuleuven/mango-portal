#!/bin/bash

export FLASK_APP=app.py
# development mode for hot reloading changed files
export FLASK_ENV=development

flask run
