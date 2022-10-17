# -*- coding: utf-8 -*-

from waitress import serve
import app
import os
import logging

logger = logging.getLogger("waitress")
logger.setLevel(logging.INFO)
service_port = str(os.environ.get("SERVICE_PORT", 80))
serve(
    app.app,
    listen="*:" + service_port,
    threads=12,
)