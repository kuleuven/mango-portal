from flask import Flask


def init_app(app: Flask):
    """Initialize the common kernel extension."""
    from .metadata import metadata_bp
    app.register_blueprint(metadata_bp)
