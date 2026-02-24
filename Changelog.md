# Changelog

Note: versioning follows Semver standard with 3 levels

## Release 0.26.0 [2026-02-12]

### Bug fixes

- project and user search API endpoint fix

### New feature

- data platform tenant switch feature


## Release 0.25.0 [2026-02-11]

### Other

- data platform changes, major mango-flow and cold-storage updates (other repos)


## Release 0.24.0 [2026-01-02]

### New features

- [core] updated PRC to 3.2.0
- [data platform] additional connection info and updates (owncloud, pam interactive, ...)

### Bug fixes

- [tika] fixed Tika bug with naive datetimes
- [metadata schema] fixed unnecessary calls to set acls in schema manager
- [metadata schema] fixed schema form for single value autocomplete until second level composite with try catch for errors
- [metadata schema] updated schema form conditional logic to set autocomplete value when not multiple
- [metadata schema] fixed schema form for autocomplete to show options on focus

### Other

- cleanup of unused imports

## Release 0.23.0 [2025-09-18]

### Bug fixes

- minor

#### Changed configs

- ManGO Flow (mostly not in this repo)

## Release 0.22.0 [2025-08-04]

### New features

- Automated user management (Mostly ManGO Flow, but also UI updates in operator group manager to upload YAML files)
- Metadata schemas are now native irods data objects. See `src/bin/migrate_schemas.py` for the migration script
- Patched version of PRC for irods 5.x compatibility
- metadata download as json
- reworked UI for metadata views

### Bug fixes

- Fixed crash (Tika) due to the use of naive datetime objects, while irods serves full ones

## Release 0.21.0 [2025-04-10]

### New features

- Increased download limit to 50GB over http
- Upgraded PRC requirement to 3.1.0 (use requirements-mango-flow.txt)

### Bug fixes



## Release 0.20.0 [2025-04-08]

### New features

- allow icons in extra tabs (currently for cold storage plugin)
- groups logic display: sort groups but "public" last in list
- smaller improvements

### Bug fixes

- fixed deprecated code in tmpFiles (upload), however the route and function is deprecated anyway

see also plugins

## Release 0.19.0 [2025-02-19]

### New features

- gallery view: display collection contents via the data object preview as thumnnails
- cold storage: external plugin with important new functionality for arhiving, but prepared the core mango portal to have all overrides in place
- template overrides: have a new possible depth criterion for collection/data object paths
- template overrides: allow for {{zone}} in direct paths, just as with subtrees (useful for listing the home collection)
- separation of various handlers into their own space for collection and data oject opertions:metadata handling, bulk operations, permissions, 
- flexible system for registering new tabs in collection and data object views via plugins

### Bug fixes
- various smaller improvements, no large bugs

## Release 0.18.4 [2025-01-13]

### New features

- made collection tab templates overridable, including nested tabs in extra

### Bug fixes

- better datetime handling in schema based metadata
- upgraded dependent PRC fork to 2.2.0 level
- data platform: better reporting of HTTP API version (KULeuven specific)


## Release 0.18.3 [2024-12-13]

### Bug fixes

- Copy nove bulk operations: side nav ("off canvas") was not functioning anymore

## Release 0.18.2 [2024-12-09]


### New features

- Attempt to stabilise user experience: avoid looping over all possible results in query(User) in PRC
- Upgrade of all Python packages
- Collection tabs are now also governed as pluggable UI nav elements


### Bug fixes 

## Release 0.18.1 [2024-11-26]

### Bug fixes

- Hotfix managed schema editing

## Release 0.18.0 [2024-11-22]

### New features

- Updated PRC to 2.2.0
- Activated audit plugin

### Improvements

- Perform full streaming of files in upload and download
- iRODS session caching and logic is now more robust 
- removing opensearch from the plugins directory: it lives in its own repository
- made interfce elements more pluggable (tabs in the data object view)
- smaller bug fixes

## Release 0.17.0 (development, quality)     [2024-08-27]

### New features

Mainly metadata schema manager:

- Library of (complex) fields
- UI improvements and polishing

## Release 0.16.0 (development, production ) [2024-06-26]

### New features

- Recursive delete option for permissions on collections
- Metadata schema manager: more friendly editing of complex fields
- Updated PRC to 2.0.0

### Bug fixes

- refactored removed permissions calls into acls  

## Release 0.15.0 (development, production) [development: since sept 2023, production: 2024-02-07]

### New features

The main changes are related to the possibility of a generic use of the ManGO portal for other installations with third parties and is necessary to fully open source the software stack.

A dedicated document is created in the file `Custom-deployments.md` which is WIP

- Generic module: basic user and group management. This plugin can be activated and enables users with a rodsadmin or groupadmin role to manage users and groups

In addition, changed various parts for Kafka indexing:

- Implementation for OpenSearch indexing must be specified, defaults to "external"
- If this value is "internal", a local indexing thread is created and listeners configured
- Some field definitions have changed
- Admin indexing actions are disabled in the view template


### Bug fixes

- Fixed metadata schema version validation code to allow more than 9 versions in any part
 

## Release 0.14.1 [2023-08-22 (t,q,p)]

### Smaller improvements and bug fixes

- Added role in user profile, yet another example of template overrides
- Fixed bug (crash) for regular users trying to view the members of a group but have no roles assigned (re-adding vanished check)

## Release 0.14.0 (t,q,p) [2023-08-04 (t,q), 2023-08-21 (p)]

### New features

- Introduced the paradigm of "logging in into projects" besides the zones (plugin user_tantra). 
    - landing page displays a card for every project the current user is entitled to
    - "Entering" a project means that the project's 2 main properties (name and path) are saved in the flask and irods user sessions as the active "realm"
    - The sidebar menu is overriden with a plugin specific template that displays the realm name along an exit button and modifies the menu items for browsing, templates, search and group management to go direct to the realm specific pages
- Introduced support for repeatable nested composite fields of different levels for metadata schemas (as long as they are created by importing from JSON).

### Smaller improvements and bug fixes

- Additional check for Host header in order to decide which logo to use on the data platform API landing page
- Fixed max download size in template code to match the code guard limit 
- Template overrides: "always" option was not working, easy fix
- Landing page is now configurable (points a the plugins/user_tantra/realm.py route)
- Started implementing the dynamic registration of plugins via configs rather than hardcoded in the main app.py application entry point (Python importlib module)
- Bulk copy/move: subdirectories of collections with spaces in their names were not shown as possible destinations, fixed.
- Metadata schema manager: fields previously selected for deletion would be deleted every time another field was deleted, fixed.
- Refined the regular expressions in the names of metadata schema fields to prevent repetition.
- Metadata schemas can now be requested via either status or version number.
- Operator sessions bug fix: they were destroyed upon checking their validity

## Release 0.13.2 (t,q) [2023-07-20]

### Smaller improvements and bug fixes

- Synchronous bulk download is available for data objects
- Allow copy/download bulk operations for non-owners

## Release 0.13.1 (t,q) [2023-07-19]

### Smaller improvements and bug fixes

- changed temp upload directory to use the nfs storage given the larger upload limits could crash the container

## Release 0.13.0 (t,q) [2023-07-19]

### New features

- Added initial statistics to projects (Via Mustafa)

### Bug fixes

- Fixed bug in bulk operations: make sure a HTML id does not contain spaces (via Mariana)

### Smaller improvements and bug fixes

- Increased download (50GiB) and upload limits (5GiB per file)
- Corrections to connection info pages (via Filip)

## Release 0.12.6 (t,q) [2023-06-26]

### Bug fixes

- Made data platform / irods sessions more robust against missing name/email openid attributes (via Peter)

## Release 0.12.5 (t,q) [2023-06-19]

### Bug fixes

- Avoid showing doubles in case metadata units are set

## Release 0.12.4 [2023-06-16]

### Bug fixes

- Made medata schema rendering more robust, coping with units set on metadata by scripts or icommands while also being schema managed

## Release 0.12.3 [2023-06-15]

### Bug fixes

- Fixed fatal error when sanitizing user generated metadata

### Smaller improvements and bug fixes

- Limit size for Tika analysis to 200MB awaiting async implementation
- More statistics from OpenSearch aggregations

## Release 0.12.2 [2023-06-07]

### Bug fixes

- Fixed bug: viewing individual data objects in the trash throws a fatal error
- Consistency in initializing variables
## Release 0.12.1 [2023-06-07]

### Bug fixes

- Fixed bug (robustness): when a schema is missing, a fatal error shows for composite fields because the data was structured differently. Now an existence check is performed with a fallback to the older behavior.

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
- adopting yaml as a config format for any new features (WIP)
- if an openid definition for a user is found, the metadata for that user is updated if not set already: name and email (via new plugin "user_tantra")

### Bug fixes
- fixed crash in top search bar

### Smaller changes/features
- groups in user profile are sorted alphabetically
- zone name is now displayed next to the logos in the top left
- admin section has red border around sidebar menu and main content block
- new jinja2 template filters: exposing regular expressions
- OpenSearch extension now uses the common operator sessions
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