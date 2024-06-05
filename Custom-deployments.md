# Custom deployments

The ManGO portal can be deployed for vanilla iRODS installations by not enabling the KU Leuven specific plugins. 

Furthermore, there are extension points and configuration options to fully customize the experience for specific requirements and custom plugins.

The main parameter for the overall configuration can be set via an environment variable `MANGO_CONFIG`. If this is not set, the application will try to read from the default `config.py`.

> See also some [notes](#notes-when-using-irods_demo-in-a-local-setup) when using a default/demo setup of iRODS 

## Plugins and activation

Plugins are modules containing at least one Flask `blueprint` and are activated via the variable `MANGO_PLUGIN_BLUEPRINTS`. This is a list of modules and blueprints that is imported dynamically by the application. If you leave this empty, obviously no plugins will be loaded.

Below is the configuration that loads KU Leuven specific plugins

You can also create your own folder to collect your plugins

```python
MANGO_PLUGIN_BLUEPRINTS = [
    # {"module": "", "blueprint": ""},
    {"module": "plugins.mango_open_search.search", "blueprint": "mango_open_search_bp"},
    {"module": "plugins.mango_open_search.admin", "blueprint": "mango_open_search_admin_bp"},
    {"module": "plugins.mango_open_search.api", "blueprint": "mango_open_search_api_bp"},
    {"module": "plugins.mango_open_search.stats", "blueprint": "mango_open_search_stats_bp"},
    {"module": "plugins.data_platform.user", "blueprint": "data_platform_user_bp"},
    {"module": "plugins.data_platform.project", "blueprint": "data_platform_project_bp"},
    {"module": "plugins.data_platform.autocomplete", "blueprint": "data_platform_autocomplete_bp"},
    {"module": "plugins.operator_group_manager.admin", "blueprint": "operator_group_manager_admin_bp"},
    {"module": "plugins.operator.admin", "blueprint": "operator_admin_bp"},
    {"module": "plugins.admin.admin", "blueprint": "admin_admin_bp"},
    {"module": "plugins.template_overrides.admin", "blueprint": "template_overrides_admin_bp"},
    {"module": "plugins.user_tantra.realm", "blueprint": "user_tantra_realm_bp"},
    {"module": "plugins.mango_overrides", "blueprint": "mango_overrides_bp"},
]
```

## iRODS zones configuration

As the ManGO portal is multi-tenant out of the box, the iRODS zones (one or more) it should serve are configured via a dedicated file specified via `IRODS_ZONES_CONFIG` env variable (with a default `irods_zones_config.py`) which contains dictionary structures with parameters for the zones concerned. 

The parameters are mainly for authentication, but some extra parameters are available to display custom logos and optionally a splash image:

```python
    # located in static folder
    "logo": "vsc-combi.webp",  
    "splash_image": "portal2.jpg",
```

A correct configuration is mandatory for the default login mode when using the generic portal server startup through `src/run_waitress_generic.sh`.  `irods_zones_config_minimal.py` can be used as a starting point to add your own zones configuration.

## Authentication

Authentication is possible for generic installations in development mode or by using the standard iRODS authentication. The main environment parameter that configures the authentication method is `MANGO_AUTH`.

### Local development mode

When specifyng `MANGO_AUTH=localdev` either as an environment variable or by configuration in `MANGO_CONFIG`, the zone and session parameters are read from `~/.irods/irods_environment.json` and a login using those local credentials is performed automatically. 

For a vanilla iRODS installation like the official irods_demo docker setup [https://github.com/irods/irods_demo/](https://github.com/irods/irods_demo/), the defult authentication method should be set to `MANGO_AUTH=login`.

The provided startup script `src/run_waitress_generic_local.sh` has this configuration and is actually suited to be used out of the box against a irods_demo docker setup. 

### Basic authentication

When specifying  `MANGO_AUTH=login` and the configuration has specified the required login routes:

```python
  MANGO_LOGIN_ACTION = "user_bp.login_basic"
  MANGO_LOGOUT_ACTION = "user_bp.logout_basic"
```

then the zone(s) are read and a login form is activated where any valid user can login using the correct iRODS credentials. Make sure that `IRODS_ZONES_CONFIG` points to a valid configuration.


### OIDC plugin (KUL specific, can be used for inspiration)

To be written

## Main landing page

The main landing page is also available for custom override via the `MANGO_CONFIG` parameter `MANGO_MAIN_LANDING_ROUTE`.

Below is an example that overrides the main landing page (a splash image by default) with a custom route from a plugin. The default is the function `index` from `kernel.common.browse` which just displays a spash image and the main sidebar menu.

```python
MANGO_MAIN_LANDING_ROUTE = {
    "module": "plugins.user_tantra.realm", 
    "function": "index"
}
```

In order to have the collection view as default, you can use 
```python
MANGO_MAIN_LANDING_ROUTE = {"module": "kernel.common.browse", "function": "collection_browse"}
```

## Template overrides

The ManGO portal has a powerful override mechanism for the used Jinja2 templates. The main configuration is governed by a YAML file that is specified by the `MANGO_CONFIG` variable `MANGO_OVERRIDE_TEMPLATE_RULES_CONFIG`. 

Below is the basic configuration which applies to all iRODS zones, the third entry shows an example from a KUL specific plugin that overrides the default sidebar template

```yaml
---
zone: all

collection_view_trash:
  source: common/collection_view.html.j2
  target: common/collection_view_trash.html.j2
  matches:
    all:
      subtree: '/{{zone}}/trash' #quotes needed as in principle {} are special characters
object_view_trash:
  source: common/object_view.html.j2
  target: common/object_view_trash.html.j2
  matches:
    all:
      subtree: '/{{zone}}/trash'

realm_powered_side_bar:
  source: sidebar.html.j2
  target: user_tantra/sidebar.html.j2
  matches: always

```

## Registering custom plugins and UI customisation

Besides the plugin blueprint registration described earlier, custom plugins can register a sidebar menu entry, either for the regular user pages or the admin section (or both).

This can be accomplished as follows (example from the kernel/common blue print) for the regular user sidebar:

```python
from mango_ui import register_module

UI = {
    "title": "Collections", 
    "bootstrap_icon": "folder",
    "description": "Browse your collections",
    "blueprint": browse_bp.name,
    "index": "collection_browse",
}
```

or for the admin sidebar

```python
from mango_ui import register_module_admin

ADMIN_UI = {
    "title": "Opensearch",
    "bootstrap_icon": "search",
    "description": "Opensearch tools",
    "blueprint": mango_open_search_admin_bp.name,
    # Here "index" is omitted, it defaults to the "index" route of the blueprint
}

```


## Admin pages

The admin pages (if any) are only accessible for a set of explicitly defined iRODS user accounts:

```python
MANGO_ADMINS = ['rods', 'u0123318'] # list of usernames that would be considered ManGO portal admins
```

## Tika for meta data inspection and extraction

This functionality will be moved to a dedicated plugin. In order to use it, tika needs to be set up in server mode. The instructions can be found on the corresponding web site https://tika.apache.org/

For the ManGO portal, the tika URL needs to be specified in `MANGO_CONFIG` with the entry either hard coded or env variable `TIKA_URL`

```python
TIKA_URL = os.environ.get("TIKA_URL", "http://localhost:9998/")
```

## Notes when using irods_demo in a local setup

When using the irods_demo docker setup together with the generic mango portal config locally (say Linux/WSL on your laptop), there are some attention points:

### Exposing port 1247 and more for a localhost ManGO portal deployment

By default ports 1247, 1248, 20000 range are not exposed to localhost. This is because of the way docker compose works. You can alter the file `docker-compose.yml` in the service definition of `irods-catalog-provider` and add the ports explicitly. Also, a fixed hostname for the container is a better option than configuring your host's /etc/hosts

```yaml
    irods-catalog-provider:
        build:
            context: irods_catalog_provider
        ports:
            - "1247:1247"
            - "1248:1248"
            - "20000-20199:20000-20199"
        hostname: irods_demo
```

### Only rodsadmin can login

By default, a vanilla iRODS Zone does not grant the group `public` with read access to the collections `/tempZone/home` and `/tempZone/trash/home`.

You should grant read access as a rodsadmin in the ManGO portal for the `public` group or by using iCommands:

```bash
ichmod read public /tempZone
ichmod read public /tempZone/home
ichmod read public /tempZone/trash
ichmod read public /tempZone/trash/home
```
