from flask import Flask


def init_app(app: Flask):
    from .admin import template_overrides_admin_bp

    app.register_blueprint(template_overrides_admin_bp)
