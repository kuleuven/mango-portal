/**
 * Information about a schema from the backend.
 *
 * @typedef {Object} SchemaInfo
 * @property {String} name - Name of the schema.
 * @property {Object} schema_info - Information about the schema.
 * @property {Boolean} schema_info.archived - Whether all existing versions are archived.
 * @property {Boolean} schema_info.published - Whether there is a published version.
 * @property {Boolean} schema_info.draft - Whether there is a draft version.
 * @property {Number} schema_info.draft_count - The number of existing draft versions (max = 1).
 * @property {Number} schema_info.published_count - The number of existing published versions (max = 1).
 * @property {Number} schema_info.total_count - The number of existing versions.
 * @property {String} schema_info.published_name - The filename of the published version.
 * @property {String} schema_info.draft_name - The filename of the draft version.
 * @property {String} schema_info.latest_version - The version number (in semantic versioning) of the latest version.
 * @property {Array<String>} schema_info.versions_sorted - The existing version numbers.
 * @property {String} schema_info.realm - Realm to which the schema belongs.
 * @property {String} schema_info.title - User-facing label of the schema.
 * @property {Number} schema_info.timestamp - ???
 * @property {String} url - URL template to retrieve the contents of a version of the schema.
 *
 */

/**
 * JSON representation of a schema.
 *
 * @typedef {Object} SchemaContents
 * @property {String} schema_name - Name of the schema.
 * @property {String} version - Version number of the schema version.
 * @property {String} status - Status of the schema version ('draft', 'published' or 'archived).
 * @property {String} title - User-facing label of the schema.
 * @property {String} edited_by - User that has last edited the schema.
 * @property {String} realm - Realm to which the schema belongs.
 * @property {String} parent - If relevant, name and version number of the schema from which this schema emerged.
 * @property {Object} properties - Collection of fields that constitute the schema.
 */

/**
 * Abstract class to handle GET requests
 * @extends XMLHttpRequest
 * @property {String} url - The URL to be called.
 */
class MangoRequest extends XMLHttpRequest {
  /**
   * Instantiate a request.
   * @class
   * @param {string} url The URL for the XMLHttpRequest.
   */
  constructor(url) {
    super();
    this.url = url;
  }

  /**
   * Get the contents of the response.
   * @returns {object} The parsed contents of the response.
   */
  get json() {
    return JSON.parse(this.responseText);
  }

  /**
   * Send the GET request.
   */
  retrieve() {
    this.open("GET", this.url);
    this.send();
  }
}

/**
 * Class representing a request for a list of schemas.
 * @extends MangoRequest
 *
 */
class TemplatesRequest extends MangoRequest {
  /**
   * Get a list of schemas and deploy them on the screen.
   * @class
   * @param {UrlsList} urls Key-value pairs with necessary URLs and other backend information.
   * @param {String} container_id ID of the DOM elements that the accordions will be attached to.
   * @see SchemaGroup
   */
  constructor(urls, container_id) {
    super(urls.list);
    this.parse_response(container_id, urls);
  }

  /**
   * Read the list of schemas and generate the required accordions and badges.
   * @param {String} container_id ID of the DOM elements that the accordions will be attached to.
   * @param {UrlsList} urls Key-value pairs with the necessary urls and other backend information.
   * @see SchemaGroup
   */
  parse_response(container_id, urls) {
    this.addEventListener("load", () => {
      /**
       * @type {Array<SchemaInfo>}
       */
      let realm_schemas = this.json
      realm_permissions = realm_schemas.realm_permissions
      let grouped_templates = realm_schemas.schemas;
      // Add the new schema button if permissions are good
      // console.log(realm_permissions)
      if (checkAllPermissions(realm_permissions, ["new_schema"])) {
        starting_schema.create_creator();
      } else {
        // Provide a message to the user to contact the realm manager to create 
        // use the container id to look up
        // check if there are no published schemas at al, ie 0 schema to display
        if (realm_schemas.schemas.length == 0) {
          let msg = Field.quick(
            "div",
            "viewer",
            'This realm does not have any schemas. Contact your realm manager to create schemas or to give you the permissions to do it'
          );
          document.querySelector("#metadata_template_list_container").appendChild(msg);
        }
        console.log("Not allowed to create new schemas, nah!")
      }


      // if length is 0, put a nice message 
      // container id
      for (let template of grouped_templates) {
        schema_infos[template.name]=template.schema_info
        // don't do anything if there are only archived versions
        if (!(template.schema_info.draft | template.schema_info.published)) {
          continue;
        }
        let schema_name = template.name;
        // pattern to retrieve the name, version and status from the filename
        let re =
          /(?<name>.*)-v(?<version>\d+\.\d+\.\d+)-(?<status>|published|draft).json/;
        let this_template = template.schema_info;

        // create a list of objects with the information of each version
        let versions = [];
        if (this_template.published_count > 0) {
          versions.push(this_template.published_name.match(re).groups);
        }
        if (this_template.draft_count > 0) {
          versions.push(this_template.draft_name.match(re).groups);
        }
        let title = this_template.title;

        // provide the information to generate the accordions and badges
        // this will create the schemas, which will load on demand
        new SchemaGroup(schema_name, title, versions, container_id, {
          get: template.url,
          ...urls,
        });
      }
      // if there are existing schemas
      // adapt the pattern for schema names so that existing names cannot be used
      if (grouped_templates.length > 0) {
        let existing_names = grouped_templates.map((x) => x.name).join("$|^");

        schema_pattern = `^((?!^${existing_names}$)${schema_pattern})$`;
        document
          .querySelectorAll('input[name="schema_name"]')
          .forEach((input) => input.setAttribute("pattern", schema_pattern));
      }

      // if a 'latest/current schema' is provided, focus on its accordion
      const current_schema = urls.schema_name;
      if (current_schema && Object.keys(schemas).indexOf(current_schema) > -1) {
        new bootstrap.Collapse(`#${current_schema}-schemas`).show();
        let trigger = document.querySelector(
          `#nav-tab-${current_schema} button`
        );
        bootstrap.Tab.getOrCreateInstance(trigger).show();
        const current_version = urls.schema_version;
        const version_data = grouped_templates.filter(
          (x) => x.name == current_schema
        )[0].schema_info;
        // if the version of that schema still exists, focus on that tab
        if (
          current_version &&
          version_data.versions_sorted.indexOf(current_version) > -1
        ) {
          let simple_version = current_version.replaceAll(".", "");
          let version_trigger = document.querySelector(
            `button#v${simple_version}-tab-${current_schema}`
          );
          bootstrap.Tab.getOrCreateInstance(version_trigger).show();
        }
      }
    });
  }
}

/**
 * Class representing a request for a schema (to manage).
 */
class TemplateReader extends MangoRequest {
  /**
   * Get the existing data for a schema version and render it. Called lazily the first time that the tab is opened.
   * @class
   * @param {String} url URL from which to obtain the schema version.
   * @param {Schema} schema Initialized Schema to fill in with existing data.
   */
  constructor(url, schema) {
    super(url);
    this.parse_response(schema);
  }

  /**
   * Provide the contents of the JSON file to the schema and render into the page.
   * @param {Schema} schema Initialized Schema to fill in with existing data.
   */
  parse_response(schema) {
    this.addEventListener("load", () => {
      /**
       * @type {SchemaContents}
       */
      let json = this.json;
      schema.from_json(json);
      schema.view();
    });
  }
}

/**
 * Class representing a request for a schema for annotation.
 * @extends MangoRequest
 */
class AnnotationRequest extends MangoRequest {
  /**
   * Get an existing schema and metadata associated with it to edit the metadata of a collection or data-object.
   * @class
   * @param {String} schema_url URL from which to retrieve the metadata schema.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with existing metadata related to the schema.
   * @param {String} prefix Prefix for the metadata attribute names, e.g. `mgs.book`
   */
  constructor(schema_url, annotated_data, prefix) {
    super(schema_url);
    this.parse_response(annotated_data, prefix);
  }

  /**
   * Read the JSON of a schema, generate a form for implementation and fill it with existing metadata.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with existing metadata related to the schema.
   * @param {String} prefix Prefix for the metadata attribute names, e.g. `mgs.book`
   */
  parse_response(annotated_data, prefix) {
    this.addEventListener("load", () => {
      /**
       * @type {SchemaContents}
       */
      let json = this.json;
      // generate the form
      let schema = new SchemaForm(json, container_id, prefix);
      // fill the form with existing metadata
      schema.add_annotation(annotated_data);
    });
  }
}
