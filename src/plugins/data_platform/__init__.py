import os
import logging

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")

if not API_TOKEN:
    logging.warn(f"No COZ API token, module data_platform will not work")