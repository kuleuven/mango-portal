/**
 * Collection of URLS to communicate with the backend.
 *
 * @typedef {Object} UrlsList
 * @property {String} new - The URL to post a schema version on creation, editing or publication.
 * @property {String} list - The URL to retrieve the list of existing schemas.
 * @property {String} delete - The URL to delete a draft.
 * @property {String} archive - The URL to archive a published version.
 * @property {String} realm - Name of the realm to which the schema belongs.
 * @property {String} schema_name - Name of the latest modified schema.
 * @property {String} schema_version - Version number of the latest modified schema version.
 */

/**
 * ID of the DOM element to which all the code will be hooked.
 * @type {String}
 */
const container_id = "metadata_template_list_container";
/**
 * DOM element to which all the code will be hooked. The BS5 class 'accordion' is enforced.
 * @type {HTMLDivElement}
 */
const container = document.getElementById(container_id);
container.className = "accordion accordion-flush";

/**
 * DOM element containing the information for the list ofr URLs.
 * @type {HTMLElement}
 */
let url_tag = document.getElementsByTagName("url-list")[0];
let url_list = url_tag.attributes;
/**
 * @type {UrlsList}
 */
let urls = {};
for (let url of url_list) {
  urls[url.name.replace("-", "_")] = url.value;
}
url_tag.remove();
const realm = urls.realm;

/**
 * Register of existing schemas
 * @type {Object<String,String[]>}
 */
const schemas = {};

/**
 * REGEX Pattern to control possible schema names. This pattern is then filled with existing names.
 * @type {String}
 */
let schema_pattern = "[a-z][a-z0-9_\\-]*";

/**
 * Empty schema to start with.
 * @type {Schema}
 * 
 * starting_schema is defined here but only to be initialized in httprequests.js 
 * after the realm permissions are retrieved and a related permission check is performed
 * 
 */
let starting_schema = new Schema("schema-editor-100", container_id, urls);

// Request the list of schemas and start!
let templates_request = new TemplatesRequest(urls, container_id);
templates_request.retrieve();


// permissions and related helper functions hiding the bitwise logic and make the code compact

// SCHEMA_CORE_PERMISSIONS should be synced with the Python equivalent
const SCHEMA_CORE_PERMISSIONS = {
  "read_schema": 1 << 0,
  "read_archived": 1 << 1,
  "read_draft": 1 << 2,
  "edit_draft": 1 << 3,
  "create_draft": 1 << 4,
  "delete_draft": 1 << 5,
  "publish_draft": 1 << 6,
  "create_new_schema_draft": 1 << 7,
  "archive_schema": 1 << 8,
};

let realm_permissions = 0;

function combinePermissions(permissionArray = [], from=SCHEMA_CORE_PERMISSIONS) {
  permission = 0;
  permissionArray.forEach(item => permission |= from[item]);
  return permission;
}

// some more macro-like permissions for convenience and illustration
// SCHEMA_PERMISSIONS should be synced with the Python equivalent
const SCHEMA_PERMISSIONS = {
  ...SCHEMA_CORE_PERMISSIONS,
  "write": combinePermissions(
    ["read_schema", "read_draft", "edit_draft", "create_draft", "delete_draft"]
  ),
  "read": combinePermissions(["read_schema", "read_archived"]),
  "new_schema": combinePermissions(
    [
      "create_new_schema_draft",
      "read_schema",
      "read_draft",
      "edit_draft",
      "create_draft",
      "delete_draft",
      "read_archived",
    ]
  ),
};

function checkAnyCorePermissions(target, corePermissionArray = []) {
  if (target && corePermissionArray) {
    permission = 0;
    corePermissionArray.forEach(item =>
      permission |= SCHEMA_CORE_PERMISSIONS[item]);
    return !!(target & permission);
  }
  return false;
}

function checkAllPermissions(target, permissionArray = []) {
  if (target && permissionArray) {
    permission = 0;
    permissionArray.forEach(item =>
      permission |= SCHEMA_PERMISSIONS[item]);
    return ((target & permission) === permission);
  }
  return false;
}
// end permission helper functions