from flask import Flask


def init_app(app: Flask):
    from .admin import basic_user_group_manager_admin_bp

    app.register_blueprint(basic_user_group_manager_admin_bp)