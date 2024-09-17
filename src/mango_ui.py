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


@dataclass(kw_only=True)
class TabInfo:
    """Class for building the tabs in collection and data object views"""

    id: str
    title: str
    template: str


object_view_tabs = [
    TabInfo(
        id="system",
        title="System properties",
        template="object_system_properties.html.j2",
    ),
    TabInfo(id="metadata", title="Metadata", template="object_metadata.html.j2"),
    TabInfo(
        id="permissions", title="Permissions", template="object_permissions.html.j2"
    ),
    TabInfo(id="preview", title="Preview", template="object_preview.html.j2"),
    TabInfo(
        id="analysis",
        title="Metadata inspection and extraction",
        template="object_analysis.html.j2",
    ),
]


def register_module(**kwargs):
    global navbar_entries, mango_ui_cfg
    navbar_entries[kwargs["blueprint"]] = MangoModule(**kwargs)
    # ensure the configured order
    navbar_entries = {
        enabled_module: navbar_entries[enabled_module]
        for enabled_module in mango_ui_cfg["MANGO_NAVBAR_MODULES"]
        if enabled_module in navbar_entries
    }


def register_object_view_tab(**kwargs):
    """The dictionary should have 'id', 'title' and 'template' keys."""
    object_view_tabs.append(TabInfo(**kwargs))


def register_module_admin(**kwargs):
    global admin_navbar_entries, mango_ui_cfg
    admin_navbar_entries[kwargs["blueprint"]] = MangoModule(**kwargs)
    # ensure the configured order
    admin_navbar_entries = {
        enabled_module: admin_navbar_entries[enabled_module]
        for enabled_module in mango_ui_cfg["MANGO_NAVBAR_ADMIN_MODULES"]
        if enabled_module in admin_navbar_entries
    }
