from dataclasses import dataclass


admin_navbar_entries = {}


@dataclass(kw_only=True)
class ModuleAdmin:
    """Class for building the admin menu/admin pages"""

    title: str
    bootstrap_icon: str = None
    description: str
    blueprint: str
    index: str = "index"


def register_module_admin(**kwargs):
    admin_navbar_entries[kwargs["blueprint"]] = ModuleAdmin(**kwargs)
