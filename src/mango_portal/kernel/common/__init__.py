from flask import Flask


def init_app(app: Flask):
    """Initialize the common kernel extension."""
    from .error import error_bp

    app.register_blueprint(error_bp)
    from .browse import browse_bp

    app.register_blueprint(browse_bp)
