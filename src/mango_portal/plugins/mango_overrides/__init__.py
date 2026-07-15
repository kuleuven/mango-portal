from flask import Blueprint, Flask


def init_app(app: Flask):
    mango_overrides_bp = Blueprint(
        "mango_overrides_bp", __name__, template_folder="templates"
    )

    app.register_blueprint(mango_overrides_bp)
