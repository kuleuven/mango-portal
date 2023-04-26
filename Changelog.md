# Changelog

Note: versioning follows Semver standard with 3 levels

## Release 0.10.0 [2023-04-x]

### New Features

- import/export of JSON schema parts in schema editor (kernel)
- group management via operator account (plugin)
- operator (rodsadmin) zone sessions in dedicated plugin for re-use across modules
- plugin friendly modular admin section with its own sidebar, base template, .. plugins can simply register an admin index in a new mango_ui.py core module
- search index stats and collection stats from fast open search aggregations
- besides admin extensions, any other plugin can now also register a sidebar menu entry. Refactored the standard modules to make use of it. Also, the sidebar menu order is determined solely by configuration
- adopting yaml as a config format for any new featres (WIP)

### Bug fixes
- fixed crash in top search bar

### Smaller changes/features
- groups in user profile are sorted alphabetically
- zone name is now displayed next to the logos in the top left
- admin section has red border around sidebar menu and main content block
- new jinja2 template filters: exposing regular expressions

---
## Release 0.9.0 Initial MVP [2023-04-05]

### Features

- fully multi tenant towards zones
- CRUD operations on collections, data objects and metadata
- basic permission management
- metadata schema manager (with versions) and editor
- schema based metadata editing
- bulk operations on collections and data objects
- template override system, mainly geared towards views

### Smaller changes/features
- conversion script to transform pre 2023-04 metadata schemas to the new format