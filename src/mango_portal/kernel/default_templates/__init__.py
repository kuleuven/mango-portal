from flask import Flask, Blueprint

def init_app(app: Flask):
    default_templates_bp = Blueprint("default_templates_bp", __name__, template_folder="templates")
    app.register_blueprint(default_templates_bp)