# Changelog

Note: versioning follows Semver standard with 3 levels

## Release 0.12.1 [2023-06-07]

### Bug fixes

- Fixed bug (robustness): when a schema is missing, a fatal error shows for composite fields because the data was structered differently. Now an existence check is performed with a fallback to the older behaviour.

## Release 0.12.0 [2023-06-07]

### New features

- Multiple option for composite metadata, disabling nesting of composite fields

### Bug fixes

- Fixed validation bug in schema ids (from partial match to full match)

### Smaller improvements and bug fixes

- Updated iRODS PRC to 1.1.8
- Updated all outdated dependencies (python modules)

## Release 0.11.0 (t,q) and 0.11.1 (p) [2023-05-26]

### New features

The most visible new features in this release are in the metadata schema management functions

- new description field for all fields in managed schemas, saved as a "help" property in the json files
- placeholder option and validation through regular expressions for text-style fields

### Bug fixes

- schema manager: fix issue with dropdowns and radios in same session
- schema manager: fix issues with default values in single-value multiple choice
- fixed: display of user metadata (name and email from plugin handler) in profile was not working for users without home collection
- fix bug with wrong version number being annotated when editing metadata from a schema
- fixed operator plugin: delete dialogs have now a different id per zone
- fixed schema manager: strip (leading/trailing) whitespace from option values
- fixed user/manual metadata editing: strip (leading/trailing) whitespace of form edited metadata values
- fixed bug where always the published version of a schema was used to render metadata labels, now the correct (archived/published) version is used instead

### Smaller improvements and bug fixes

- moved core admin module to plugins (where it belongs semantically), as well as remaining admin from template_overrides
- all admin routes are now protected with decorator that checks the proper user role
- checksums are displayed for data objects (via Peter)
- status field for data objects now checks the replica status (previously the native status was checked, but it is always None)

## Release 0.10 [2023-05-02]

### New Features

- import/export of JSON schema parts in schema editor (kernel)
- group management via operator account (plugin)
- operator (rodsadmin) zone sessions in dedicated plugin for re-use across modules
- plugin friendly modular admin section with its own sidebar, base template, .. plugins can simply register an admin index in a new mango_ui.py core module
- search index stats and collection stats from fast open search aggregations
- besides admin extensions, any other plugin can now also register a sidebar menu entry. Refactored the standard modules to make use of it. Also, the sidebar menu order is determined solely by configuration
- adopting yaml as a config format for any new featres (WIP)
- if an openid definition for a user is found, the metadata for that user is updated if not set already: name and email (via new plugin "user_tantra")

### Bug fixes
- fixed crash in top search bar

### Smaller changes/features
- groups in user profile are sorted alphabetically
- zone name is now displayed next to the logos in the top left
- admin section has red border around sidebar menu and main content block
- new jinja2 template filters: exposing regular expressions
- opensearch extension now uses the common operator sessions
- admin link in sidebar only for those in the role "mango_portal_admin"
- new signal upon user session creation

---
## Release 0.9 Initial MVP [2023-04-05]

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