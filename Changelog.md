# Changelog

Note: versioning follows Semver standard with 3 levels

## Release 0.10.0 [2023-04-x]

### New Features

- import/export of JSON schema parts in schema editor (kernel)
- group management via operator account (plugin)
- operator (rodsadmin) zone sessions in dedicated plugin for re-use across modules

### Bug fixes

### Smaller changes/features
- groups in user profile are sorted alphabetically
- zone name is now displayed next to the logos in the top left

---
## Release 0.9.0 Initial MVP [2023-04-05]

### Features

- Fully multi tenant towards zones
- CRUD operations on collections, data objects and metadata
- basic permission management
- metadata schema manager (with versions) and editor
- schema based metadata editing
- bulk operations on collections and data objects
- template override system, mainly geared towards views

### Smaller changes/features
- conversion script to transform pre 2023-04 metadata schemas to the new format