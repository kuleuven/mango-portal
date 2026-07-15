# """Public API for the metadata schema subsystem.

# Importing this module is cheap and side-effect-free. It only re-exports the
# abstract interfaces. To use a configured schema manager, call
# `extension.schema_extension.init_app(app)` from your app factory, then use
# `extension.get_schema_manager(zone, realm)`.
# """

# from .base import (
#     SCHEMA_CORE_PERMISSIONS,
#     SCHEMA_PERMISSIONS,
#     BaseSchemaPermissionsManager,
#     SchemaManager,
#     combine_permissions,
# )

# __all__ = [
#     "SCHEMA_CORE_PERMISSIONS",
#     "SCHEMA_PERMISSIONS",
#     "BaseSchemaPermissionsManager",
#     "SchemaManager",
#     "combine_permissions",
# ]

from flask import Flask


def init_app(app: Flask):
    """Initialize metadata schemas kernel module"""

    # first the configured schema manager
    from .base import set_schema_permissions_manager_class, set_schema_manager_class

    if schema_manager_config := app.config.get("MANGO_SCHEMA_MANAGER_CLASS", None):
        set_schema_manager_class(
            schema_manager_config["module"], schema_manager_config["class"]
        )

    if schema_permissions_manager_config := app.config.get(
        "MANGO_SCHEMA_PERMISSIONS_MANAGER_CLASS", None
    ):
        set_schema_permissions_manager_class(
            schema_permissions_manager_config["module"],
            schema_permissions_manager_config["class"],
        )

    from .editor import metadata_schema_editor_bp

    app.register_blueprint(metadata_schema_editor_bp)

    from .form import metadata_schema_form_bp

    app.register_blueprint(metadata_schema_form_bp)

    print(f"Metadata schema kernel module initialized ========================================")
