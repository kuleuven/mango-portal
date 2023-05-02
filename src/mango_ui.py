from dataclasses import dataclass
import yaml, pathlib

navbar_entries = {}
admin_navbar_entries = {}


mango_ui_cfg_path = pathlib.Path("config/mango_ui.yml")
mango_ui_cfg = yaml.safe_load(mango_ui_cfg_path.read_text())


@dataclass(kw_only=True)
class MangoModule:
    """Class for building the sidebars for the user and admin nav bars"""

    title: str
    bootstrap_icon: str = None
    description: str
    blueprint: str
    index: str = "index"


def register_module(**kwargs):
    global navbar_entries, mango_ui_cfg
    navbar_entries[kwargs["blueprint"]] = MangoModule(**kwargs)
    # ensure thee configured order
    navbar_entries = {
        enabled_module: navbar_entries[enabled_module]
        for enabled_module in mango_ui_cfg["MANGO_MODULE_BLUEPRINTS"]
        if enabled_module in navbar_entries
    }


def register_module_admin(**kwargs):
    global admin_navbar_entries, mango_ui_cfg
    admin_navbar_entries[kwargs["blueprint"]] = MangoModule(**kwargs)
    # ensure thee configured order
    admin_navbar_entries = {
        enabled_module: admin_navbar_entries[enabled_module]
        for enabled_module in mango_ui_cfg["MANGO_MODULE_ADMIN_BLUEPRINTS"]
        if enabled_module in admin_navbar_entries
    }
