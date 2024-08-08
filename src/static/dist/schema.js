/**
 * Master class to represent schemas and mini-schemas. Only the child classes are actually instantiated.
 * @property {String} title User-facing label of the schema (or composite field).
 * @property {Object<String,InputField>} placeholders Collection of empty fields to start creating.
 * @property {TypedInput} placeholders.typed Placeholder for a simple field.
 * @property {SelectInput} placeholders.select Placeholder for a single-value multiple-choice field.
 * @property {CheckboxInput} placeholders.checkbox Placeholder for a multiple-value multiple-choice field.
 * @property {ObjectInput} placeholders.object Placeholder for a composite field.
 * @property {InputField[]} fields Collection of fields that belong to the schema.
 * @property {Object<String,FieldInfo>} properties Object-version of the information of the fields, to store in a JSON.
 * @property {Number} new_field_idx Index of the following field that could be added.
 */
class ComplexField {
  /**
   * Initialize a Schema, mini-schema for a composite field or dummy mini-schema for illustrating a composite field.
   * @class
   * @param {String} name Initial name of the schema, for IDs of the DOM elements.
   */
  constructor(name) {
    // properties of the schema itself
    this.field_id_regex = "[a-zA-Z0-9_\\-]+";
    this.name = name;

    // initial state before adding any fields
    this.fields = [];
    this.empty_composite_idx = 0;
    this.wip = [];
  }

  is_composite = false;

  get prefixed() {
    return `${this.prefix || prefix}.${this.name}`;
  }

  get field_ids() {
    return this.fields.map((f) => f.id);
  }

  add_wip(fid) {
    if (this.wip.indexOf(fid) == -1) {
      this.wip.push(fid);
    }
    this.toggle_saving();
    this.autosave();
  }

  remove_wip(fid) {
    if (this.wip.indexOf(fid) > -1) {
      this.wip.splice(fid, 1);
    }
    this.toggle_saving();
    this.autosave();
  }

  update_field_id_regex() {
    this.field_id_regex = `^((?!^${this.fields
      .map((x) => x.name)
      .join("$|^")}$)[a-zA-Z0-9_\\-]+)+$`;
    this.fields.forEach((field) => field.update_id_regex(this.field_id_regex));
  }

  /**
   * Collect the Object-version of the fields into the `properties` property to save as JSON.
   */
  fields_to_json() {
    this.properties = Object.fromEntries(
      this.fields.map((field) => [field.name, field.json])
    );
  }

  add_field_box(under_button) {
    this.button = this.create_button();
    this.form_div.insertBefore(this.button, under_button);

    this.field_box = Field.quick("div", "fieldbox mt-2");
    this.form_div.insertBefore(this.field_box, this.button);
  }

  /**
   * Capture data from the JSON representation of a schema.
   * @param {SchemaContents} data JSON representation of a schema
   */
  from_json(data) {
    // The ID of the schema is coded as `schema_name` for the schemas
    this.title = data.title;
    this.status = data.status; // only relevant for Schema class
    if (
      this.status == "draft" &&
      this.ls_id != undefined &&
      this.ls_id in localStorage
    ) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      this.properties_from_json(schema_from_ls.properties);
      this.wip = schema_from_ls.wip;
    } else {
      this.properties_from_json(data.properties);
    }
  }

  properties_from_json(properties) {
    Object.entries(properties).forEach((field) => {
      let new_field = InputField.choose_class(field);
      new_field.attach_schema(this);
      new_field.create_editor();
      this.fields.push(new_field);
    });
    this.update_field_id_regex();
  }

  /**
   * Add new fields based on uploaded JSON file.
   * @param {FieldInfo} data JSON representation of a field.
   */
  add_fields_from_json(data, modal_id) {
    Object.keys(data).forEach((field_id) => {
      let new_field = InputField.choose_class([field_id, data[field_id]]);
      new_field.attach_schema(this);
      new_field.create_editor();
      new_field.add_to_schema();
    });

    bootstrap.Modal.getOrCreateInstance(
      document.getElementById(modal_id)
    ).toggle();
  }

  /**
   * Disable or enable saving a (mini-)schema based on whether any of the existing fields is a duplicate.
   * Duplicates don't have ids, so we cannot save a schema until that issue is resolved.
   */
  toggle_saving() {
    // Identify the form with moving viewers
    let form = this.form_div;

    // Check if any field is a duplicate
    const has_duplicates = this.fields.some((field) => field.is_duplicate); // not gonna happen
    const has_wip_composites = this.fields.some(
      (field) => field.minischema && field.minischema.wip.length > 0
    );

    // Buttons to update:
    const buttons =
      this.constructor.name == "Schema"
        ? ["publish", "draft"].map((btn) => form.querySelector("button#" + btn)) // publish and draft for schemas
        : [form.querySelector("button#add")]; // "add/update" for a composite field
    if (has_duplicates || has_wip_composites) {
      buttons.forEach((btn) => btn.setAttribute("disabled", ""));
    } else {
      buttons.forEach((btn) => btn.removeAttribute("disabled"));
    }
  }

  /**
   * Create a button to create more form elements. On click, it updates the value of the `new_field_idx` property.
   * It also activates the modal that offers the different types of fields.
   * @returns {HTMLDivElement} A DIV with the button.
   */
  create_button() {
    // create a div and its button
    let div = Field.quick(
      "div",
      "d-flex justify-content-between btn-group adder mt-2 rounded-2"
    );
    div.setAttribute("role", "group");
    div.setAttribute("aria-label", "Add new element");

    let button_pre = Field.quick(
      "button",
      "btn btn-outline-primary btn-light fw-bold",
      " Add "
    );
    button_pre.setAttribute("disabled", "");
    let plus_icon = Field.quick("i", "bi bi-plus-circle-fill");
    plus_icon.setAttribute("fill", "currentColor");
    button_pre.prepend(plus_icon);
    div.appendChild(button_pre);

    let input_methods = [library_request.library, designer, json_input];

    input_methods.forEach((im) => {
      let btn = Field.quick(
        "button",
        "btn btn-primary btn-sm fw-bold ms-1",
        im.message
      );
      btn.type = "button";
      btn.id = im.name;
      btn.setAttribute("data-bs-toggle", "modal");
      btn.setAttribute("data-bs-target", `#${im.modal_id}`);
      // on click, the modal will also update `new_field_idx` based on the index of the field on top of it
      btn.addEventListener("click", () => im.attach_schema(this));
      div.appendChild(btn);
    });

    return div;
  }

  /**
   * Reset the contents of this schema: no fields, initial name
   */
  reset() {
    this.fields = [];

    // if relevant, reset the name
    // if this is the initial schema and a new draft has been created
    if (this.constructor.name == "Schema" && this.status == "draft") {
      this.name = "schema-editor"; // then the name should be 'schema-editor'
    } else if (this.parent) {
      // if this is the clone of another schema
      this.name = this.parent.match(/(.+)-\d+\.\d\.\d/)[1] + "-copy"; // get the name of the parent (no versions)
    }
  }

  /**
   * Create a form or simulation of form from a Schema.
   * In the schema manager, this generates the 'view' of an existing version.
   * In the metadata annotation, this generates the form to be filled.
   * @param {Schema} schema Schema to view.
   * @param {Boolean} [active=false] Whether the form will be used for application of metadata.
   * @returns {HTMLDivElement|HTMLFormElement}
   */
  static create_viewer(schema, active = false) {
    // create a form or div depending on whether it's for annotation or not
    // active can be true for a composite field during annotation, but we should not create a form for it
    let div =
      active && schema.constructor.name == "SchemaForm"
        ? Field.quick("form", "mt-3 needs-validation")
        : Field.quick("div", "input-view");

    // go through each of the fields
    schema.fields.forEach((field) => {
      div.appendChild(ComplexField.add_field_viewer(field, active));
    });

    return div;
  }

  static add_field_viewer(subfield, active = false) {
    // create a div for the input field
    let small_div = Field.quick("div", "mini-viewer");
    small_div.setAttribute("data-field-name", subfield.name);
    let label;

    // special box and label if the field is a composite field
    if (subfield.constructor.name == "ObjectInput") {
      label = subfield.help
        ? document.createElement("h5")
        : Field.quick("h5", "border-bottom border-secondary");
      label.innerHTML = subfield.required
        ? subfield.title + "*"
        : subfield.title;
      label.id = `viewer-label-${subfield.id}`;
      small_div.className =
        small_div.className +
        " border border-1 border-secondary rounded p-3 my-1";
    } else {
      label = Field.labeller(
        subfield.required ? subfield.title + "*" : subfield.title,
        `viewer-label-${subfield.id}`
      );
    }

    // define options if the field is repeatable
    if (subfield.repeatable) {
      let icon = active
        ? SchemaForm.field_replicator(subfield, small_div, active)
        : Field.quick("i", "bi bi-front px-2");
      label.appendChild(icon);
    }

    // create the contents of the viewer based on the specific kind of field
    let input = subfield.viewer_input(active);
    small_div.appendChild(label);

    if (subfield.constructor.name == "ObjectInput" && subfield.help) {
      let help_text = Field.quick(
        "p",
        "form-text mt-0 mb-1 border-bottom border-secondary",
        subfield.help
      );
      small_div.appendChild(help_text);
    }
    small_div.appendChild(input);
    return small_div;
  }

  autosave() {
    return null;
  }

  activate_autocompletes(read = false) {
    this.fields.forEach((field) => {
      if (field.type == "object") {
        field.minischema.activate_autocompletes(read);
      } else {
        field.activate_autocomplete();
        if (read) {
          field.read_autocomplete();
        }
      }
    });
  }
}

/**
 * Class for illustration of an ObjectEditor.
 * It has three fixed IDs to illustrate: a simple text input, a simple date input and a radio.
 * @extends ComplexField
 * @property {String} schema_name The name of the fake object ("example").
 */
class DummyObject extends ComplexField {
  schema_name = "example";

  /**
   * Initialize the DummyObject.
   * @class
   */
  constructor() {
    // Initialize the basics - all we care about is actually the viewer
    let schema_name = "example";
    super(schema_name, schema_name);

    // Create a simple field of type 'text' for illustration
    let name = new TypedInput(schema_name);
    name.id = "text";
    name.title = "Full name";
    name.value = "Jane Doe";

    // Create a simple field of type 'date' for illustration
    let bday = new TypedInput(schema_name);
    bday.type = "date";
    bday.title = "Birth date";
    bday.value = "1970-05-03";

    // Create a single-value multiple-choice field for illustration
    let hair = new SelectInput(schema_name);
    hair.name = "hair";
    hair.values.values = ["brown", "red", "blond", "dark", "pink"];
    hair.value = "red";
    hair.title = "Hair color";

    this.fields = [name, bday, hair];
  }
}

/**
 * Class for mini-schemas connected to a composite field.
 * of the schema that the composite field belongs to.
 * @extends ComplexField
 * @property {String} form_id ID of the editing form of the composite field this is linked to.
 * @property {String} card_id ID of the editing modal of the composite field this is linked to. Assigned by `ObjectInput.create_editor()`.
 */
class ObjectEditor extends ComplexField {
  /**
   * Create a mini-schema for a composite field.
   * @param {ObjectInput} parent Composite field this mini-schema is linked to.
   */
  constructor(parent) {
    super(parent.id);
    this.composite = parent;
    if (this.composite.form_field != undefined) {
      this.form_div = this.composite.form_field.form;
    }
  }

  is_composite = true;

  reset_wip() {
    this.wip = [];
    this.toggle_saving();
  }

  get card() {
    return undefined;
  }

  toggle_saving() {
    const card = this.form_div.parentElement.parentElement;
    if (this.wip.length > 0) {
      card.classList.replace("border-primary", "border-danger");
      card.classList.add("bg-danger-subtle");
      this.composite.form_field.rowsub
        .querySelector("button#add")
        .removeAttribute("disabled");
    } else {
      card.classList.remove("bg-danger-subtle");
      card.classList.replace("border-danger", "border-primary");
      this.composite.form_field.rowsub
        .querySelector("button#add")
        .setAttribute("disabled", "");
    }
    this.composite.schema.toggle_saving();
  }
}

/**
 * Class for a version of a schema.
 * @extends ComplexField
 * @property {String} card_id ID of the DIV that everything related to this version of the schema is rendered; also part of the IDs of elements inside of it. It combines the name and version.
 * @property {String} name ID of the schema itself, if it exists.
 * @property {String} version Version number of this version of the schema.
 * @property {String} container ID of the DOM element inside which this schema version is displayed.
 * @property {UrlsList} urls Collection of URLs and other information obtained from the server side.
 * @property {String} parent If this schema was born as clone of another schema, the name and version of the parent schema.
 * @property {Object} origin If this is a draft initiated as clone of a published schema, information on the fields that are cloned with it.
 * @property {String[]} origin.ids IDs of the fields cloned with a clone schema.
 * @property {Object<String,FieldInfo>} origin.json Collection of Object-versions of the fields cloned with a clone schema.
 * @property {Schema} child If this is a published schema, the draft Schema for its clone.
 * @property {AccordionItem|HTMLDivElement} card The DIV that contains everything related to this version of the schema. It's an `AccordionItem` for the new (empty) schema.
 * @property {SchemaDraftForm} form Form that gets submitted when the schema version is saved or published.
 * @property {NavBar} nav_bar Navigation bar and tab contents with view and editor(s) of this version of the schema.
 */
class Schema extends ComplexField {
  /**
   * Initialize a new version of a schema.
   * @class
   * @param {String} card_id ID for the DIV this version will be hosted on, combining the version number and name.
   * @param {String} container_id ID of the parent DIV.
   * @param {UrlsList} urls Collection of URLs and other information obtained from the server side.
   * @param {String} [version=1.0.0] Version number of this version of the schema.
   */
  constructor(card_id, container_id, urls, version = "1.0.0") {
    const card_id_match = card_id.match(/^(.*)-(\d+\d+\d+)(-copy)?$/);
    const clean_card_id = `${card_id_match[1]}-${card_id_match[2]}`;
    super(clean_card_id);
    this.card_id = clean_card_id;
    this.name =
      card_id_match[3] == undefined
        ? card_id_match[1]
        : card_id_match[1] + card_id_match[3];
    this.ls_id = `_mgs_${card_id}`;
    this.prefix = prefix;
    this.version = version;
    this.container = container_id;
    this.urls = urls;
    this.nav_bar_btn_ids = {};
    this.form = new SchemaDraftForm(this);
    this.form_div = this.form.form;
  }

  /**
   * Capture data from the JSON representation of a schema.
   * @param {SchemaContents} data JSON representation of a schema
   */
  from_json(data) {
    this.saved_json = data;
    super.from_json(data);

    // retrieve schema-specific information
    this.name = data.schema_name;
    this.version = data.version;
    this.parent = data.parent;

    this.create_editor();
  }

  /**
   * Create the editing form and option-display for a new schema to design from scratch.
   */
  create_creator() {
    if (this.ls_id in localStorage && this.fields.length == 0) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      this.properties_from_json(schema_from_ls.properties);
    }
    this.status = "draft";

    // Create the form to assign ID and label and add fields
    this.create_editor();

    // Create and fill the accordion item that creates a new schema
    this.card = new AccordionItem(
      this.card_id,
      "New schema",
      this.container,
      true
    );
    document.getElementById(this.container).appendChild(this.card.div);
    this.card.append(this.form.form);

    if (this.ls_id in localStorage) {
      this.offer_reset_ls();
      this.fields.forEach((field) => field.view_field());
    }
  }

  /**
   * Create an editing form for this schema. The form contains
   * - a field to provide a name (read-only if a draft has been saved)
   * - a field to provide a user-facing title/label (read-only if a version has been published)
   * - one or more buttons to add fields, and MovingViewers if there are fields already
   * - submission buttons
   */
  create_editor() {
    // define if this is the first draft of a schema and it has never been saved
    let is_new =
      this.name.endsWith("copy") || this.card_id.startsWith("schema-editor");

    // create and add an input field for the ID (or 'name')
    this.form.add_input("Schema ID", this.card_id + "-name", {
      placeholder: "schema-name",
      validation_message: validation_text,
      pattern: schema_pattern,
      description: is_new
        ? "This cannot be changed after the draft is saved." + " " + description_text
        : false,
    });
    const name_input = this.form.form.querySelector(`#${this.card_id}-name`);
    name_input.name = "schema_name";
    name_input.addEventListener("change", () => {
      this.temp_name = name_input.value;
      this.add_wip(".name");
    });

    // create and add an input field for the user-facing label/title
    this.form.add_input("Schema label", this.card_id + "-label", {
      placeholder: "Some informative label",
      validation_message: "This field is compulsory.",
      description: is_new
        ? "This cannot be changed once a version has been published."
        : false,
    });
    const title_input = this.form.form.querySelector(`#${this.card_id}-label`);
    title_input.name = "title";
    title_input.addEventListener("change", () => {
      this.temp_title = title_input.value;
      this.add_wip(".title");
    });
    if (this.ls_id in localStorage) {
      let ls_data = JSON.parse(localStorage.getItem(this.ls_id));
      if (is_new && "name" in ls_data) {
        name_input.value = this.temp_name = ls_data.name;
      }
      if ("title" in ls_data && ls_data.title !== undefined) {
        title_input.value = this.temp_title = ls_data.title;
      }
    }
    // create and add the first button to add fields
    this.add_field_box(this.form.divider);

    // create and add a submission button that saves the draft without publishing
    this.form.add_action_button("Save draft", "draft");
    this.form.add_submit_action("draft", (e) => {
      // BS5 validity check
      if (!this.form.form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        this.form.form.classList.add("was-validated");
      } else {
        this.save_draft("save");
        this.form.form.classList.remove("was-validated");
      }
    });

    // create and add a submission button that publishes the draft
    this.form.add_action_button("Publish", "publish", "warning");
    this.form.add_submit_action("publish", (e) => {
      e.preventDefault();
      // BS5 validity check
      if (!this.form.form.checkValidity()) {
        e.stopPropagation();
        this.form.form.classList.add("was-validated");
      } else {
        // trigger confirmation message, which also has its hidden fields
        let second_sentence =
          !this.card_id.endsWith("-copy") &&
            schemas[this.name] &&
            schemas[this.name].published.length > 0
            ? ` Version ${schemas[this.name].published[0]} will be archived.`
            : "";
        let starting_data = {
          schema_name: this.name,
          title: this.title,
          current_version: this.version,
          with_status: this.status,
          realm: realm,
          raw_schema: "",
          parent: "",
        };
        // fill the confirmation modal with the right hidden fields
        // if accepted, go through the 'save_draft' part and submit
        Modal.submit_confirmation(
          "Published schemas cannot be edited." + second_sentence,
          this.urls.new,
          starting_data,
          () => {
            this.save_draft("publish");
          }
        );
        this.form.form.classList.remove("was-validated");
      }
    });

    if (!is_new) {
      name_input.setAttribute("readonly", ""); // name cannot be changed if a version has been saved
      if (
        schemas[this.name].published.length +
        schemas[this.name].archived.length >
        0
      ) {
        title_input.setAttribute("readonly", ""); // title cannot be changed if there is a published or archived version in history
      }
    }

    // if there are no fields, the draft cannot be published
    if (this.fields.length == 0) {
      this.form.form
        .querySelector("button#publish")
        .setAttribute("disabled", "");
    }
  }

  /**
   * For clones: fill a clone Schema based on the contents of its parent.
   * @param {Schema} parent Schema of the parent.
   */
  from_parent(parent) {
    this.parent = `${parent.name}-${parent.version}`; // register name and version of the parent
    this.status = "draft";
    this.origin = {
      json: { ...parent.properties },
    };
    if (this.ls_id != undefined && this.ls_id in localStorage) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      this.properties_from_json(schema_from_ls.properties);
      this.wip = schema_from_ls.wip;
    } else {
      this.properties_from_json(parent.properties);
    }
    this.create_editor(); // create form
    this.nav_bar = parent.nav_bar;
  }

  /**
   * For published versions: create a clone/child as base for a new schema.
   */
  setup_copy() {
    // initialize a new schema and transfer the contents
    this.child = new Schema(
      this.card_id + "-copy",
      this.container,
      this.urls,
      "1.0.0"
    );

    this.child.from_parent(this);
    this.nav_bar_btn_ids["create_new_schema_draft"] = this.nav_bar.add_item(
      tab_prefixes["copy"],
      "Copy to new schema"
    ); // add to tabs
    this.nav_bar.add_tab_content(tab_prefixes["copy"], this.child.form.form); // add form to tab
    if (this.child.ls_id in localStorage) {
      this.child.offer_reset_ls();
    }
  }

  prepare_json_download() {
    if (this.fields.length == 0) {
      return;
    }
    this.fields_to_json();
    let to_download = { ...this.properties };
    let for_download = Field.quick("div", "py-3");

    // set up text to download
    let for_download_full = Field.quick("p", "fst-italic");

    // link to download full schema
    let full_link = Field.quick(
      "a",
      "link-dark fw-semibold",
      "Download the full schema"
    );
    full_link.setAttribute(
      "download",
      `${this.name}-${this.version}-${this.status}.json`
    );
    full_link.setAttribute("style", "cursor: pointer;");
    full_link.addEventListener(
      "click",
      (e) =>
      (e.target.href = `data:text/json;charset=utf-8,${JSON.stringify(
        this.saved_json,
        null,
        "  "
      )}`)
    );
    for_download_full.appendChild(full_link);

    // intermediate text
    let span1 = Field.quick(
      "span",
      "",
      " (the saved version) or click on the checkboxes to select the fields you want and "
    );
    for_download_full.appendChild(span1);

    let fields_link = Field.quick(
      "a",
      "link-dark fw-semibold",
      "download specific fields."
    );
    fields_link.setAttribute(
      "download",
      `${this.name}-${this.version}-fields.json`
    );
    fields_link.setAttribute("style", "cursor: pointer;");
    fields_link.addEventListener(
      "click",
      (e) =>
      (e.target.href = `data:text/json;charset=utf-8,${JSON.stringify(
        to_download,
        null,
        "  "
      )}`)
    );
    for_download_full.appendChild(fields_link);

    // create universal checkbox
    let select_all_box = Field.quick("div", "form-check form-check-inline");
    let select_all_input = Field.quick("input", "form-check-input");
    select_all_input.type = "checkbox";
    select_all_input.id = "select_all";
    select_all_input.setAttribute("aria-label", "select all fields");
    select_all_input.setAttribute("checked", "");
    let select_all_label = Field.quick(
      "label",
      "form-check-label",
      "(Un)select all fields"
    );
    select_all_label.setAttribute("for", "select_all");
    select_all_box.appendChild(select_all_input);
    select_all_box.appendChild(select_all_label);

    // checkboxes to select fields
    let field_checkboxes = Field.quick("div", "border rounded p-2 mb-1");
    this.fields.forEach((field) => {
      let field_div = Field.quick("div", "form-check form-check-inline");

      let input = Field.quick("input", "form-check-input");
      input.type = "checkbox";
      input.id = `download-${field.name}`;
      input.value = field.name;
      input.setAttribute("aria-label", `select-${field.name}`);
      input.setAttribute("checked", "");
      input.addEventListener("change", () => {
        let selected = [
          ...field_checkboxes.querySelectorAll("input:checked"),
        ].map((x) => x.value);
        let filtered_json = { ...this.properties };
        Object.keys(filtered_json).forEach((x) => {
          if (selected.indexOf(x) == -1) {
            delete filtered_json[x];
          }
        });
        to_download = { ...filtered_json };
        json_rendering.innerHTML = JSON.stringify(to_download, null, "  ");

        // if all checkboxes are checked
        if (
          [
            ...field_checkboxes.querySelectorAll('input[type="checkbox"]'),
          ].every((el) => el.checked)
        ) {
          select_all_input.setAttribute("checked", "");
        } else {
          select_all_input.removeAttribute("checked");
        }

        // if there are no selected filled
        if (Object.keys(filtered_json).length == 0) {
          fields_link.setAttribute("style", "pointer-events:none;");
        } else {
          fields_link.setAttribute("style", "cursor: pointer;");
        }
      });

      let label = Field.quick(
        "label",
        "form-check-label font-monospace",
        field.name
      );
      label.setAttribute("for", `download-${field.name}`);
      field_div.appendChild(input);
      field_div.appendChild(label);
      field_checkboxes.appendChild(field_div);
    });
    // one checkbox to rule them all
    select_all_input.addEventListener("change", () => {
      if (select_all_input.checked) {
        field_checkboxes
          .querySelectorAll('input[type="checkbox"]')
          .forEach((el) => (el.checked = true));
        fields_link.setAttribute("style", "cursor: pointer;");
        to_download = { ...this.properties };
        json_rendering.innerHTML = JSON.stringify(to_download, null, "  ");
      } else {
        field_checkboxes
          .querySelectorAll('input[type="checkbox"]')
          .forEach((el) => (el.checked = false));
        fields_link.setAttribute("style", "pointer-events:none;");
        to_download = {};
        json_rendering.innerHTML = JSON.stringify({}, null, "  ");
      }
    });

    // show json of selected fields
    let json_rendering = Field.quick("pre", "border p-1 bg-light");
    json_rendering.setAttribute("style", "white-space: pre-wrap;");
    json_rendering.innerHTML = JSON.stringify(this.properties, null, "  ");

    for_download.appendChild(for_download_full);
    for_download.appendChild(select_all_box);
    for_download.appendChild(field_checkboxes);
    for_download.appendChild(json_rendering);

    this.nav_bar.add_item("json", "Download JSON");
    this.nav_bar.add_tab_content("json", for_download);
  }

  /**
   * Design the navigation bar and tab contents for this version of the schema.
   * For a published version, this includes the 'view', 'new draft' (if relevant) and 'copy to new schema',
   * as well as the 'archive' button.
   * For a draft version, this includes the 'view' and 'edit' tabs as well as the 'discard' button.
   */
  create_navbar() {
    // initialize NavBar
    this.nav_bar = new NavBar(this.card_id, [
      "justify-content-end",
      "nav-pills",
    ]);

    // add button and tab for viewing the saved form of the schema version
    this.nav_bar.add_item("view", "View", true);
    const viewer = ComplexField.create_viewer(this);
    this.viewer = viewer;
    this.nav_bar.add_tab_content("view", viewer);

    if (this.status == "draft") {
      // add button and tab for editing the schema
      this.nav_bar_btn_ids["edit_draft"] = this.nav_bar.add_item(
        tab_prefixes[this.status],
        "Edit"
      );

      // fill in the name and titles
      this.form.form.querySelector('[name="schema_name"]').value = this.name; // id
      if (
        !(
          this.ls_id in localStorage &&
          "title" in JSON.parse(localStorage.getItem(this.ls_id))
        )
      ) {
        this.form.form.querySelector('[name="title"]').value = this.temp_title =
          this.title; // label
      }

      // add the new form to the 'edit' tab
      this.nav_bar.add_tab_content(tab_prefixes[this.status], this.form.form);

      // add a json view
      this.prepare_json_download();

      // add and define 'discard' button
      this.nav_bar_btn_ids["delete_draft"] = this.nav_bar.add_action_button(
        "Discard",
        "danger",
        () => {
          // fill the confirmation modal with the hidden form to delete this schema
          Modal.submit_confirmation(
            "A deleted draft cannot be recovered.",
            this.urls.delete,
            {
              realm: realm,
              schema_name: this.name,
              with_status: "draft",
            }
          );
        }
      );
    } else if (this.status == "published") {
      // get the object-version of the current fields
      this.fields_to_json();

      // create a form for a new draft
      // checks also for the existence of a draft version
      // only if there are no existing drafts
      if (schemas[this.name].draft.length == 0) {
        this.setup_draft();
      }

      // initalize a new schema as child/clone and create its modal and form
      this.setup_copy();

      // add a json view
      this.prepare_json_download();

      // add and define the 'archive' button
      this.nav_bar_btn_ids["archive_schema"] = this.nav_bar.add_action_button(
        "Archive",
        "danger",
        () => {
          // Fill the confirmation modal with the hidden fields to archive this schema version
          Modal.submit_confirmation(
            "Archived schemas cannot be implemented.",
            this.urls.archive,
            {
              realm: realm,
              schema_name: this.name,
              with_status: "published",
            }
          );
        }
      );
    }
  }

  setup_draft() {
    this.nav_bar_btn_ids["create_draft"] = this.nav_bar.add_item(
      tab_prefixes["new"],
      "New (draft) version",
      false,
      1
    ); // create tab

    let incremented_major = parseInt(this.version.split(".")[0]) + 1;
    this.temp = new Schema(
      this.card_id,
      this.container,
      this.urls,
      `${incremented_major}.0.0`
    );
    schemas[this.name].draft = this.temp.draft_from_publish(this);
    // this.nav_bar.add_tab_content(tab_prefixes["new"], this.temp.form.form);
  }

  /**
   * Set up an editor for a draft from a published version
   */
  draft_from_publish(previous_version) {
    this.from_json({
      schema_name: previous_version.name,
      title: previous_version.title,
      status: "draft",
      version: this.version,
      properties: { ...previous_version.properties },
    });
    this.nav_bar = previous_version.nav_bar; // fill in name and title
    this.form.form.querySelector('[name="schema_name"]').value = this.name; // id
    this.form.form.querySelector('[name="title"]').value = this.title; // label
    this.nav_bar.add_tab_content(tab_prefixes["new"], this.form.form); // add form to tab
    if (this.ls_id in localStorage) {
      this.offer_reset_ls();
    }
  }

  /**
   * Show the schema version on the page: create its tabs and render its fields.
   */
  view() {
    this.create_navbar(); // create navigation bar and tabs

    // create a div, append the navigation bar and tabs, and append it to the container
    this.card = document.createElement("div");
    this.card.id = this.card_id;
    this.card.appendChild(this.nav_bar.nav_bar);
    this.card.appendChild(this.nav_bar.tab_content);
    document.getElementById(this.container).appendChild(this.card);

    Object.keys(this.nav_bar_btn_ids).forEach((permission) => {
      let use_permissions = schema_infos[this.name].current_user_permissions
        ? schema_infos[this.name].current_user_permissions
        : realm_permissions;
      if (!checkAllPermissions(use_permissions, [permission])) {
        document
          .getElementById(this.nav_bar_btn_ids[permission])
          .setAttribute("disabled", "disabled");
      }
    });

    if (this.status == "draft" && this.ls_id in localStorage) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      if (
        this.latest_saved == undefined ||
        schema_from_ls.last_modified > this.latest_saved
      ) {
        this.temp_title = schema_from_ls.title;
        // this.properties_from_json(schema_from_ls);
        this.offer_reset_ls();
      } else if (schema_from_ls.last_modified <= this.latest_saved) {
        this.reset_ls();
      }
    }

    // show a message if there are no fields
    if (this.fields.length == 0) {
      let msg = Field.quick(
        "div",
        "viewer",
        'This schema does not have any fields yet. Go to "edit" mode to add one.'
      );
      this.nav_bar.tab_content.querySelector(".input-view").appendChild(msg);
    }

    // show all existing fields
    this.fields.forEach((field) => field.view_field());

    if (this.status == "published") {
      this.child.fields.forEach((field) => field.view_field());
      if (this.temp) {
        this.temp.fields.forEach((field) => field.view_field());
      }
    }

    if (last_mod_ls in localStorage) {
      const { schema_name, editing_tab } = JSON.parse(
        localStorage.getItem(last_mod_ls)
      );
      if (
        schema_name == this.name &&
        document.querySelector(editing_tab) !== null
      ) {
        bootstrap.Tab.getOrCreateInstance(
          document.querySelector(editing_tab)
        ).show();
      }
    }

    this.activate_autocompletes();
  }

  /**
   * Make final adjustments before posting a draft to be saved or published.
   * @param {String} action If 'publish', the draft will be published, otherwise it will just be saved.
   */
  save_draft(action) {
    // update the status
    let status = action == "publish" ? "published" : "draft";

    this.name = this.form.form.querySelector('[name="schema_name"]').value;
    this.title = this.form.form.querySelector('[name="title"]').value;

    // retrieve Object-version of the fields as this.properties
    this.fields_to_json();

    // group updated date to submit
    let form_fields = {
      current_version: this.version,
      with_status: status,
      raw_schema: JSON.stringify(this.properties), // stringify fields (properties)
    };

    // register parent if relevant
    if (this.parent) {
      form_fields.parent = this.parent;
    }

    // update the form right before submission
    if (status == "draft") {
      // original form for drafts
      Object.entries(form_fields).forEach((item) =>
        this.form.update_field(item[0], item[1])
      );
    } else {
      // confirmation form (which does not include name and title yet) for published
      form_fields.schema_name = this.name;
      form_fields.title = this.title;
      Modal.fill_confirmation_form(form_fields);
    }
    this.reset_ls();
  }

  autosave() {
    if (this.wip.length == 0) {
      return;
    }
    this.fields_to_json();
    const to_save = {
      title: this.temp_title ? this.temp_title : this.title,
      properties: this.properties,
      last_modified: Date.now() / 1000,
      wip: this.wip,
    };
    if (
      this.card_id.endsWith("copy") ||
      this.card_id.startsWith("schema-editor")
    ) {
      to_save.name = this.temp_name ? this.temp_name : this.name;
    }
    if (!(this.ls_id in localStorage)) {
      this.offer_reset_ls();
    }
    localStorage.setItem(this.ls_id, JSON.stringify(to_save));
    if (!this.card_id.startsWith("schema-editor")) {
      localStorage.setItem(
        last_mod_ls,
        JSON.stringify({
          ls_id: this.ls_id,
          timestamp: Date.now() / 1000,
          schema_name: this.name,
          schema_version: this.version,
          editing_tab: this.editing_tab,
        })
      );
    }
  }

  offer_reset_ls() {
    const is_new =
      this.card_id.endsWith("-copy") ||
      this.card_id.startsWith("schema-editor");

    const msg_row = Field.quick(
      "div",
      "row alert alert-warning p-2 mt-2 shadow"
    );
    const col_left = Field.quick("main", "col p-0 m-0");
    const col_right = Field.quick("aside", "col-3 p-0 m-0");
    msg_row.appendChild(col_left);
    msg_row.appendChild(col_right);

    let msg_box = Field.quick(
      "span",
      "",
      "You are seeing a temporary version of this draft; click on the buttons at the bottom to save your schema."
    );
    msg_box.setAttribute("role", "alert");
    msg_box.id = "autosave-warning";
    col_left.appendChild(msg_box);

    let btn = Field.quick(
      "button",
      "btn btn-warning fw-bold",
      is_new ? "Reset" : "Revert to saved changes"
    );
    // btn.setAttribute("style", "cursor: pointer;");
    btn.addEventListener("click", () => {
      this.reset_ls();
      if (!this.card_id.startsWith("schema-editor")) {
        const new_search = `?schema_name=${this.name}&schema_version=${this.version}`;
        location.replace(location.origin + location.pathname + new_search);
      } else {
        location.reload();
      }
    });
    col_right.appendChild(btn);

    this.form.form.parentElement.insertBefore(msg_row, this.form.form);
  }

  reset_ls() {
    localStorage.removeItem(this.ls_id);
    this.wip = [];
    if (last_mod_ls in localStorage) {
      const last_modified = JSON.parse(localStorage.getItem(last_mod_ls));
      last_modified.timestamp = Date.now();
      localStorage.setItem(last_mod_ls, JSON.stringify(last_modified));
    }
  }
}

/**
 * Class for a schema with all its versions, to render on the page.
 * @property {String} name Name of the schema (shared by all versions).
 * @property {String} title User-facing label of the schema (shared by all versions).
 * @property {Array<Object>} versions List of versions with their name, number and status.
 * @property {String[]} statuses List of used statuses.
 * @property {UrlsList} urls Collection of URLs and other info obtained from the server.
 * @property {Object<String,String[]>} summary List of versions per status.
 */
class SchemaGroup {
  /**
   * URL for the images that generate the badges.
   * @type {String}
   * @static
   */
  static badge_url = "https://img.shields.io/badge/";

  /**
   * Mapping between status and color of the badge.
   * @type {Object<String,String>}
   * @static
   */
  static status_colors = {
    published: "success",
    draft: "orange",
    archived: "inactive",
  };

  /**
   * Create and fill an accordion item and the tabs for the versions of a schema.
   * @class
   * @param {String} name Name of the schema.
   * @param {String} title User-facing label of the schema.
   * @param {Array<Object>} versions List of versions with their name, number and status.
   * @param {String} container_id ID of the DOM element on which the schema is shown.
   * @param {UrlsList} urls Collection of URLs and other information received from the server.
   */
  constructor(name, title, versions, container_id, urls, timestamp) {
    this.name = name;
    this.title = title;
    this.versions = versions;
    this.latest_saved = timestamp;

    // create navigation bar and tabs for the full schema (all its versions)
    let nav_bar = new NavBar(this.name, ["nav-tabs"]);
    this.statuses = this.versions.map((v) => v.status);
    this.urls = urls;

    // obtain the list of versions existing for each status
    this.summary = {};
    Object.keys(SchemaGroup.status_colors).forEach((st) => {
      this.summary[st] = this.versions
        .filter((v) => v.status == st)
        .map((v) => v.version);
    });
    schemas[name] = this.summary; // add this to the global variable

    // create an accordion item for the full schema and add the tabs
    let acc_item = new AccordionItem(
      this.name + "-schemas",
      this.title,
      container_id
    );
    acc_item.append(nav_bar.nav_bar);
    acc_item.append(nav_bar.tab_content);
    document.getElementById(container_id).appendChild(acc_item.div);

    // go through each existing version and add its tab + badge
    this.versions.forEach((version) => this.load_version(version, nav_bar));
  }

  /**
   * Fill in the tab corresponding to a specific version of the schema.
   * This includes creating a Schema for it and a TemplateReader to retrieve the contents from server-side.
   * @param {Object} version Information about the version to be loaded.
   * @param {String} version.number Version number of this version.
   * @param {String} version.status Status of this version.
   * @param {String} version.name Name of this schema (=this.name).
   * @param {NavBar} nav_bar Navigation bar and tabs on which the version will be shown.
   */
  load_version(version, nav_bar) {
    // create the version and status badge for this version
    let badges = SchemaGroup.create_badges(version.version, version.status);

    // if there is a published version and it's this one, focus on it, otherwise focus on the draft
    let active =
      this.statuses.indexOf("published") > -1
        ? version.status == "published"
        : version.status == "draft";
    // this does not account for a case with only archived versions and a draft

    // remove dots from the versio number so it can be used in DOM ids
    let version_number = version.version.replaceAll(".", "");

    // add a tab and content for this specific version
    nav_bar.add_item(`v${version_number}`, badges, active);

    // create a new Schema for this version
    let tab_id = `v${version_number}-pane-${this.name}`;
    let schema = new Schema(
      `${version.name}-${version_number}`,
      tab_id,
      this.urls,
      version.version
    );
    if (version.status == "draft") {
      schema.latest_saved = this.latest_saved;
    }
    schema.loaded = false;
    const accordion = nav_bar.tab_content.parentElement.parentElement;

    // create an HTTP request for this schema
    let reader = new TemplateReader(
      `${this.urls.get}?version=${version.version}`,
      schema
    ); // url to get this template

    // once the accordion is opened
    accordion.addEventListener("show.bs.collapse", () => {
      const tab = accordion.querySelector("#" + tab_id);
      if (tab.classList.contains("show")) {
        // when the tab of this version is shown, if the schema has not been loaded it yet, load it
        if (!schema.loaded) {
          reader.retrieve();
          schema.loaded = true;
        }
      } else {
        // if the tab is not the first one, activate it and do the same
        nav_bar.nav_bar
          .querySelector(`button#v${version_number}-tab-${this.name}`)
          .addEventListener("show.bs.tab", () => {
            if (!schema.loaded) {
              reader.retrieve();
              schema.loaded = true;
            }
          });
      }
    });
  }

  /**
   * Create badges for the version number and status of a schema version.
   * @static
   * @param {String} version Version number of the schema version.
   * @param {String} status Status of a schema version.
   * @returns {HTMLImageElement[]} Version and status badges.
   */
  static create_badges(version, status) {
    let version_badge = document.createElement("img");
    version_badge.setAttribute("alt", "version " + version);
    version_badge.setAttribute("name", version);
    version_badge.setAttribute(
      "src",
      `${SchemaGroup.badge_url}version-${version}-blue`
    );

    let status_badge = Field.quick("img", "mx-2");
    status_badge.setAttribute("alt", "status " + status);
    status_badge.setAttribute("name", status);
    status_badge.setAttribute(
      "src",
      `${SchemaGroup.badge_url}-${status}-${SchemaGroup.status_colors[status]}`
    );
    return [version_badge, status_badge];
  }
}
