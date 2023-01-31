import os

API_URL = os.environ.get(
    "API_URL", "https://icts-p-coz-data-platform-api.cloud.icts.kuleuven.be"
)
API_TOKEN = os.environ.get("API_TOKEN", "")