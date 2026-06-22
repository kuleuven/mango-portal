from flask import Blueprint

mango_overrides_bp = Blueprint(
    "mango_overrides_bp", __name__, template_folder="templates"
)
