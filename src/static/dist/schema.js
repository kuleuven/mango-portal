/**
 * Master class to represent schemas and mini-schemas. Only the child classes are actually instantiated.
 * @property {String} modal_id ID of the modal through which a new input field can be chosen.
 * @property {String} initial_name Placeholder name for DOM element IDs.
 * @property {String} title User-facing label of the schema (or composite field).
 * @property {String} data_status Derived status used for IDs of DOM elements, e.g. 'new', 'copy', 'draft'...
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
   * @param {String} data_status Derived status used in IDs of DOM elements.
   */
  constructor(name, data_status = "draft") {
    // properties of the schema itself
    this.initial_name = name;

    if (!String(data_status).endsWith("undefined")) {
      this.data_status = data_status;
    }
    this.field_id_regex = "[a-zA-Z0-9_\\-]+";

    // Placeholder fields to start with
    this.placeholders = {
      typed: new TypedInput(this),
      select: new SelectInput(this),
      checkbox: new CheckboxInput(this),
      object: new ObjectInput(this),
    };

    // initial state before adding any fields
    this.fields = [];
    this.empty_composite_idx = 0;
    this.wip = [];
  }

  is_composite = false;

  get prefix() {
    return `mgs__${this.name}`;
  }

  get modal_id() {
    return `m-${this.prefix}-${this.data_status}`;
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
    this.field_id_regex = `^((?!^${this.field_ids.join(
      "$|^"
    )}$)[a-z0-9_\\-]+)+$`;
    this.fields.forEach((field) => field.update_id_regex(this.field_id_regex));
    Object.keys(this.placeholders).forEach((key) => {
      this.placeholders[key].update_id_regex(this.field_id_regex);
    });
  }

  /**
   * Collect the Object-version of the fields into the `properties` property to save as JSON.
   */
  fields_to_json() {
    this.properties = Object.fromEntries(
      this.fields.map((field) => [field.id, field.json])
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
  from_json(data, id = null) {
    // The ID of the schema is coded as `schema_name` for the schemas
    this.name = id == null ? data.schema_name : id;
    this.title = data.title;
    this.status = data.status; // only relevant for Schema class
    this.data_status = this.set_data_status();
    if (!this.data_status.startsWith("object")) {
      this.ls_id = `_mgs_${this.card_id}_${this.data_status}`;
    }
    if (this.ls_id != undefined && this.ls_id in localStorage) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      this.properties_from_json(schema_from_ls);
      this.wip = schema_from_ls.wip;
    } else {
      this.properties_from_json(data);
    }
  }

  properties_from_json(data) {
    const is_manager = !this.data_status.endsWith("undefined");
    Object.entries(data.properties).forEach((field) => {
      let new_field = InputField.choose_class(this, null, field);
      if (is_manager) {
        new_field.create_editor();
      }
      this.fields.push(new_field);
    });
    if (is_manager) {
      this.update_field_id_regex();
    }
  }

  /**
   * Add new fields based on uploaded JSON file.
   * @param {FieldInfo} data JSON representation of a field.
   */
  add_fields_from_json(data, modal_id) {
    Object.keys(data).forEach((field_id) => {
      let new_field = InputField.choose_class(this, null, [
        field_id,
        data[field_id],
      ]);
      new_field.create_editor();
      new_field.add_to_schema();
    });

    bootstrap.Modal.getOrCreateInstance(
      document.getElementById(modal_id)
    ).toggle();
  }

  /**
   * Compute the `data_status` property based on the status of the version.
   * @returns {String}
   */
  set_data_status() {
    return;
  }

  /**
   * Create a modal that offers the different fields that can be added and fill it when shown.
   */
  display_options() {
    if (this.data_status.endsWith("library")) {
      return;
    }
    this.data_status = this.set_data_status(); // to make sure it's correct (but maybe this is redundant)
    this.ls_id = `_mgs_${this.card_id}_${this.data_status}`;

    // create a div to fill in with the different field examples
    let design_modal_contents = Field.quick("div", "formContainer");
    design_modal_contents.id = this.data_status + "-templates";

    // create the modal and add the div
    let design_modal = new Modal(
      this.modal_id + "-design",
      "What form element would you like to create?"
    );
    design_modal.create_modal([design_modal_contents], "lg");

    // when the modal is first shown, render all the placeholder fields
    let design_modal_modal = document.getElementById(this.modal_id + "-design");
    design_modal_modal.addEventListener("show.bs.modal", () => {
      let design_modal_contents =
        design_modal_modal.querySelector("div.formContainer");
      if (design_modal_contents.childNodes.length == 0) {
        Object.values(this.placeholders).forEach((placeholder) => {
          placeholder.data_status = this.data_status;
          design_modal_contents.appendChild(placeholder.render());
        });
      }
    });
  }

  /**
   * Disable or enable saving a (mini-)schema based on whether any of the existing fields is a duplicate.
   * Duplicates don't have ids, so we cannot save a schema until that issue is resolved.
   */
  toggle_saving() {
    // Identify the form with moving viewers
    let form = this.form_div;

    // Check if any field is a duplicate
    const has_duplicates = this.fields.some((field) => field.is_duplicate);
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

    let buttons = [
      { id: "library", message: "Browse library", modal_id: Library.modal_id },
      {
        id: "design",
        message: "Design from scratch",
        modal_id: `${this.modal_id}-design`,
      },
      { id: "file", message: "Upload JSON", modal_id: JsonInput.modal_id },
    ];

    buttons.forEach((button) => {
      let btn = Field.quick(
        "button",
        "btn btn-primary btn-sm fw-bold ms-1",
        button.message
      );
      btn.type = "button";
      btn.id = button.id;
      btn.setAttribute("data-bs-toggle", "modal");
      btn.setAttribute("data-bs-target", `#${button.modal_id}`);
      // on click, the modal will also update `new_field_idx` based on the index of the field on top of it
      btn.addEventListener("click", () => {
        this.new_field_idx = div.previousSibling.classList.contains("viewer")
          ? this.field_ids.indexOf(div.previousSibling.id) + 1
          : 0;
        if (button.id == "library") {
          library_request.library.attach_schema(this);
        } else if (button.id == "file") {
          json_input.attach_schema(this);
        }
      });
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
      this.name = this.parent.match(/(.+)-\d+\.\d\.\d/)[1]; // get the name of the parent (no versions)
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
    // QUESTION should the code inside the forEach be defined in the InputField classes?
    schema.fields.forEach((field) => {
      div.appendChild(ComplexField.add_field_viewer(field, active));
    });

    return div;
  }

  static add_field_viewer(subfield, active = false) {
    // create a div for the input field
    let small_div = Field.quick("div", "mini-viewer");
    small_div.setAttribute("data-field-name", subfield.id);
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
    delete this.placeholders;

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
 * `data_status` always starts with 'object', followed by the `data_status`
 * of the schema that the composite field belongs to.
 * @extends ComplexField
 * @property {String} parent_status `data_status` of the (mini-)schema the composite field belongs to.
 * @property {String} form_id ID of the editing form of the composite field this is linked to.
 * @property {String} card_id ID of the editing modal of the composite field this is linked to. Assigned by `ObjectInput.create_editor()`.
 */
class ObjectEditor extends ComplexField {
  /**
   * Create a mini-schema for a composite field.
   * @param {ObjectInput} parent Composite field this mini-schema is linked to.
   */
  constructor(parent) {
    const parent_status = String(parent.data_status);
    super(
      parent.id,
      `${parent_status.startsWith("object") ? "" : "object-"}${parent_status}`
    );
    this.composite = parent;
    if (this.composite.form_field != undefined) {
      this.form_div = this.composite.form_field.form;
    }
  }

  is_composite = true;

  get prefix() {
    return `${this.composite.schema.prefix}-${this.composite.id}`;
  }

  reset_wip() {
    this.wip = [];
    this.toggle_saving();
  }
  /**
   * Obtain the data_status of the mini-schema.
   * @returns {String} Derived status as used in IDs for DOM elements.
   */
  set_data_status() {
    return String(this.composite.data_status).endsWith("undefined")
      ? "undefined"
      : this.data_status;
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

  set new_name(name) {
    const current_ids = Object.fromEntries(
      this.fields.map((field) => [field.id, field.editing_modal_id])
    );
    this.name = name;
    this.composite.id = name;
    const new_ids = Object.fromEntries(
      this.fields.map((field) => [field.id, field.editing_modal_id])
    );
    this.fields.forEach((field) => {
      const old_modal = document.getElementById(current_ids[field.id]);
      if (old_modal != null) {
        old_modal.id = new_ids[field.id];
      }
    });
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
   * @param {String} [data_status=draft] Derived status used for IDs of DOM elements.
   */
  constructor(
    card_id,
    container_id,
    urls,
    version = "1.0.0",
    data_status = "draft"
  ) {
    super(card_id, data_status);
    this.card_id = card_id;
    this.ls_id = `_mgs_${this.card_id}_${this.data_status}`;
    this.name = card_id.match(/^(.*)-\d+\d\d$/)[1];
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
    this.create_editor();

    // retrieve schema-specific information
    this.name = data.schema_name;
    this.version = data.version;
    this.parent = data.parent;
  }

  /**
   * Obtain the data_status of the schema.
   * This is used in the IDs of DOM elements related to editing a schema.
   * - 'new' indicates a new draft from a published version.
   * - 'draft' indicates a new schema from scratch or an existing draft version.
   * - 'copy' indicates a clone of a published version (before it has been saved as draft).
   * @returns {String} Derived status as used in IDs for DOM elements.
   */
  set_data_status() {
    if (this.status == "published") {
      return "new";
    } else if (this.origin == undefined) {
      return "draft";
    } else {
      return "copy";
    }
  }

  /**
   * Create the editing form and option-display for a new schema to design from scratch.
   */
  create_creator() {
    this.status = "draft";

    if (this.ls_id in localStorage && this.fields.length == 0) {
      let schema_from_ls = JSON.parse(localStorage.getItem(this.ls_id));
      this.properties_from_json(schema_from_ls);
    }
    // Create modal that shows the possible fields to add
    this.display_options();

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
      this.data_status == "copy" || this.card_id.startsWith("schema-editor");

    // create and add an input field for the ID (or 'name')
    this.form.add_input("Schema ID", this.card_id + "-name", {
      placeholder: "schema-name",
      validation_message:
        "This field is compulsory, please only use lower case letters or numbers, '_' and '-'. Existing IDs cannot be reused.",
      pattern: schema_pattern,
      description: is_new
        ? "This cannot be changed after the draft is saved."
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
      if (is_new) {
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
          this.data_status != "copy" &&
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
    this.initial_name = `${parent.name}-new`;
    this.status = "draft"; // start as draft (but data_status will be 'copy')
    this.origin = {
      json: { ...parent.properties },
    };
    this.nav_bar = parent.nav_bar;
    // go through each existing field and clone it
    Object.entries(parent.properties).forEach((entry) => {
      let new_field = InputField.choose_class(this, "child", entry);
      new_field.create_editor();
      this.fields.push(new_field);
    });
  }

  /**
   * For published versions: create a clone/child as base for a new schema.
   */
  setup_copy() {
    // get the object-version of the current fields
    this.fields_to_json();

    // initialize a new schema and transfer the contents
    this.child = new Schema(
      this.card_id,
      this.container,
      this.urls,
      "1.0.0",
      "copy"
    );
    this.child.create_editor(); // create form

    this.child.from_parent(this);
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
    this.field_ids.forEach((field) => {
      let field_div = Field.quick("div", "form-check form-check-inline");

      let input = Field.quick("input", "form-check-input");
      input.type = "checkbox";
      input.id = `download-${field}`;
      input.value = field;
      input.setAttribute("aria-label", `select-${field}`);
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
        field
      );
      label.setAttribute("for", `download-${field}`);
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

      // create the modal to show the options for new fields
      this.display_options();

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
      // create modal and form for a new draft
      // checks also for the existence of a draft version
      this.draft_from_publish();

      // initalize a new schema as child/clone and create its modal and form
      this.setup_copy();
      this.child.display_options(); // create field-choice modal
      this.nav_bar_btn_ids["create_new_schema_draft"] = this.nav_bar.add_item(
        tab_prefixes["copy"],
        "Copy to new schema"
      ); // add to tabs
      this.nav_bar.add_tab_content(tab_prefixes["copy"], this.child.form.form); // add form to tab
      if (this.child.ls_id in localStorage) {
        this.child.offer_reset_ls();
      }

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

  /**
   * Set up an editor for a draft from a published version
   */
  draft_from_publish() {
    // only if there are no existing drafts
    if (schemas[this.name].draft.length == 0) {
      this.display_options(); // create field-choice modal
      this.nav_bar_btn_ids["create_draft"] = this.nav_bar.add_item(
        tab_prefixes["new"],
        "New (draft) version",
        false,
        1
      ); // create tab

      // fill in name and title
      this.form.form.querySelector('[name="schema_name"]').value = this.name; // id
      this.form.form.querySelector('[name="title"]').value = this.title; // label

      this.nav_bar.add_tab_content(tab_prefixes["new"], this.form.form); // add form to tab
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

    if (this.ls_id in localStorage) {
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

    // if this is a new version from an existing published one, increment the versio number
    if (this.data_status == "new") {
      let incremented_major = parseInt(this.version.split(".")[0]) + 1;
      this.version = `${incremented_major}.0.0`;
    }
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
      this.data_status == "copy" ||
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
          editing_tab: `#${tab_prefixes[this.data_status]}-tab-${
            this.nav_bar.id
          }`,
        })
      );
    }
  }

  offer_reset_ls() {
    const is_new =
      this.data_status == "copy" || this.card_id.startsWith("schema-editor");

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
    schema.latest_saved = this.latest_saved;
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

/**
 * Class for a published version of a schema to be used when applying metadata.
 * @property {String} name Name of the schema.
 * @property {String} title User-facing label/title of the schema.
 * @property {String} container_id ID of the DIV to which the form will be attached.
 * @property {String} prefix Prefix of the metadata attribute names, e.g. `msg.book`.
 * @property {String} realm Name of the realm to which the schema belongs.
 * @property {String} version Version number of the current schema version.
 * @property {String} parent Name of the schema this schema was cloned from, if relevant. (Not implemented)
 * @property {Object<String,InputField>} fields Collection of fields that constitute this schema.
 * @property {HTMLFormElement} form Form used to implement the metadata annotation.
 */
class SchemaForm {
  /**
   * Create a form to apply metadata from a schema.
   * @param {SchemaInfo} json Contents of the JSON file on which the schema is stored.
   * @param {String} container_id ID of the DIV to which the form will be attached.
   * @param {String} prefix Prefix of the metadata attribute names, e.g. `msg.book`.
   */
  constructor(json, container_id, prefix) {
    // retrieve properties from the JSON contents
    this.name = json.schema_name;
    this.title = json.title;
    this.realm = json.realm;
    this.version = json.version;
    this.parent = json.parent;

    this.container = container_id;
    this.prefix = prefix;

    // create the form and add the fields
    this.from_json(json.properties);
  }

  get field_ids() {
    return this.fields.map((field) => field.id);
  }

  /**
   * Create the form with all its fields.
   * @param {Object<String,FieldInfo>} schema_json Collection of Object-versions of fields.
   */
  from_json(schema_json) {
    function expand_composites(composite_field) {
      composite_field.minischema = new ObjectEditor(composite_field);
      composite_field.minischema.from_json(composite_field.json_source);
      composite_field.minischema.fields.forEach((subfield) => {
        if (subfield.form_type == "object") {
          expand_composites(subfield);
        }
      });
    }
    // Go through each field in the JSON file and create its InputField
    this.fields = Object.entries(schema_json).map((entry) => {
      let new_field = InputField.choose_class(this, null, entry);
      if (new_field.form_type == "object") {
        expand_composites(new_field);
      }
      return new_field;
    });

    // Create names with the flattened ids, even inside objects
    SchemaForm.flatten_object(this, this.prefix);

    // Create the form, enabled for annotation
    let form_div = ComplexField.create_viewer(this, true);

    // Add a title to the form
    let title = document.createElement("h3");
    title.innerHTML = `<small class="text-muted">Metadata schema:</small> ${this.title} ${this.version}`;
    document.getElementById(this.container).appendChild(title);

    // Retrieve information from the URL and add it to the form as hidden fields
    const url = new URL(window.location.href);
    const url_params = url.searchParams;
    let version_name = `${prefix}.__version__`;
    for (let item of [
      "item_type",
      "object_path",
      "schema",
      "realm",
      version_name,
    ]) {
      let hidden_input = document.createElement("input");
      hidden_input.type = "hidden";
      hidden_input.name = item;
      hidden_input.value =
        item == version_name ? this.version : url_params.get(item);
      form_div.appendChild(hidden_input);
    }

    // Create a row for the submission button
    let submitting_row = Field.quick("div", "row border-top pt-2");
    let submitter = Field.quick("button", "btn btn-primary", "Save metadata");
    submitter.type = "submit";
    submitting_row.appendChild(submitter);
    form_div.appendChild(submitting_row);

    // Add attributes to the form so it submits directly
    form_div.setAttribute("action", post_url);
    form_div.setAttribute("method", "POST");
    form_div.setAttribute("novalidate", "");
    // Include BS5 validation
    form_div.addEventListener("submit", (e) => {
      if (!form_div.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form_div.classList.add("was-validated");
    });

    document.getElementById(this.container).appendChild(form_div);
    this.card = form_div;
    this.activate_autocompletes();
  }

  activate_autocompletes() {
    this.fields.forEach((field) => {
      if (field.type == "object") {
        field.minischema.activate_autocompletes(true);
      } else {
        field.activate_autocomplete();
        field.read_autocomplete();
      }
    });
  }

  /**
   * Fill in the form with existing metadata.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   */
  add_annotation(annotated_data) {
    // add a hidden field with the value of 'redirect_route
    let hidden_input = document.createElement("input");
    hidden_input.type = "hidden";
    hidden_input.name = "redirect_route";
    hidden_input.value = annotated_data.redirect_route[0];
    this.card.appendChild(hidden_input);

    // exclude non-metadata keys, e.g. 'redirect_route'
    let keys = Object.keys(annotated_data).filter(
      (x) => x.startsWith(this.prefix) && !x.endsWith("__version__")
    );
    const top_level_names = this.field_ids.map((x) => `${this.prefix}.${x}`);

    // extract fields that are not in composite fields and register them
    let non_objects = keys.filter(
      (fid) =>
        typeof annotated_data[fid][0] != "object" &&
        top_level_names.indexOf(fid) > -1
    );
    non_objects.forEach((fid) => this.register_non_object(fid, annotated_data));

    // extract fields that are in composite fields
    let objs = keys.filter(
      (fid) =>
        typeof annotated_data[fid][0] == "object" &&
        top_level_names.indexOf(fid) > -1
    );
    // identify the unique composite fields
    // go through each composite field and register its subfields
    objs.forEach((fid) =>
      this.register_object(fid, annotated_data, this.fields[fid])
    );

    SchemaForm.prepare_objects(this, annotated_data, this.card, this.prefix);
  }

  /**
   * Retrieve the annotated data corresponding to fields inside a given composite field.
   * @param {String} obj Flattened ID of the composite field.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   * @param {String} prefix Prefix common to all these fields.
   * @param {HTMLFormElement|HTMLDivElement} form Form or div element inside which we can find the input field to fill in.
   */
  register_object(
    obj,
    annotated_data,
    fields = null,
    prefix = null,
    form = null
  ) {
    // Start with the original prefix, but accumulate when we have nested composite fields
    prefix = prefix || this.prefix;
    form = form || this.card;
    fields = fields || this.fields;

    // Identify the fields that belong to this particular composite fields
    let existing_values = annotated_data[obj];
    let raw_name = obj.match(`${prefix}.(?<field>[^\.]+)`).groups.field;
    let minischema = fields.filter((f) => f.id == raw_name)[0].minischema;
    let top_level_names = minischema.field_ids.map((x) => `${obj}.${x}`);
    let first_unit =
      "__unit__" in existing_values[0]
        ? String(existing_values[0].__unit__[0])
        : "1";
    let first_viewer = [...form.childNodes].filter(
      (child) =>
        child.classList.contains("mini-viewer") &&
        child.getAttribute("data-field-name") == raw_name
    )[0];
    first_viewer.setAttribute("data-composite-unit", first_unit);
    first_viewer.querySelectorAll("[name]").forEach((subfield) => {
      if (subfield.name.split(".").length == obj.split(".").length + 1) {
        subfield.name = `${subfield.name.split("__")[0]}__${first_unit}`;
      }
    });
    if (existing_values.length > 1) {
      for (let i = 0; i < existing_values.length - 1; i++) {
        first_viewer.querySelector("h5 button").click();
      }
    } else if (!("__unit__" in existing_values[0])) {
      existing_values[0]["__unit__"] = ["1"];
    }
    existing_values.forEach((object) => {
      let unit = object.__unit__[0];
      let viewer = [...form.childNodes]
        .filter(
          (child) =>
            child.classList.contains("mini-viewer") &&
            child.getAttribute("data-field-name") == raw_name &&
            child.getAttribute("data-composite-unit") == String(unit)
        )[0]
        .querySelector("div.input-view");

      // Extract the fields that are not inside nested composite fields and register them
      let not_nested = Object.keys(object).filter(
        (fid) =>
          typeof object[fid][0] != "object" &&
          fid != "__unit__" &&
          top_level_names.indexOf(fid) > -1
      );
      not_nested.forEach((fid) => {
        this.register_non_object(fid, object, viewer);
      });

      // Extract the fields that are inside nested composite fields
      let nested = Object.keys(object).filter(
        (fid) =>
          typeof object[fid][0] == "object" && top_level_names.indexOf(fid) > -1
      );
      // Go through each nested composite field and register its subfields, with an accumulated prefix
      nested.forEach((fid) =>
        this.register_object(fid, object, minischema.fields, obj, viewer)
      );
    });
  }

  /**
   * Register the annotated value of a specific (non composite) field.
   * @param {String} fid Flattened ID of the field to fill in.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   * @param {HTMLFormElement|HTMLDivElement} form Form or div element inside which we can find the input field to fill in.
   */
  register_non_object(fid, annotated_data, form = null) {
    // Start with the original form, but in fields inside a composite field it will be its div.
    form = form || this.card;

    // Extract the data linked to this field
    let existing_values = annotated_data[fid];
    let input_name =
      "__unit__" in annotated_data ? `${fid}__${annotated_data.__unit__}` : fid;

    // Identify checkboxes as cases where there are multiple input fields with the same name in the form
    // (this is only for multiple-value multiple-choice fields)
    let is_checkbox =
      [...form.querySelectorAll(`[name="${input_name}"]`)].filter((x) =>
        x.classList.contains("form-check-input")
      ).length > 0;

    // if we indeed have multiple-value multiple-choice
    if (is_checkbox) {
      form.querySelectorAll(`[name="${input_name}"]`).forEach((chk) => {
        if (existing_values.indexOf(chk.value) > -1)
          chk.setAttribute("checked", "");
      });
    } else if (existing_values.length == 1) {
      // if there is only one value for this field
      form.querySelector(`[name="${input_name}"]`).value = existing_values[0];
    } else {
      // if the field has been duplicated
      // go through each of the values and repeat the input field with its corresponding value
      let first_input = form.querySelector(
        `[data-field-name="${fid.split(".").pop()}"]`
      );
      const answers = first_input.querySelector("div[id$='answers']");
      if (answers != null) {
        for (let value of existing_values) {
          const [pill, label] = Field.autocomplete_checkbox(value, input_name);
          answers.appendChild(pill);
          answers.appendChild(label);
        }
      } else {
        for (let i = 0; i < existing_values.length - 1; i++) {
          first_input.querySelector("label button").click();
        }
        form.querySelectorAll(`[name="${input_name}"]`).forEach((input, i) => {
          input.value = existing_values[i];
        });
      }
    }
  }

  static prepare_objects(
    object_editor,
    annotated_data,
    form,
    prefix,
    unit = 1
  ) {
    object_editor.fields
      .filter((field) => field.type == "object")
      .forEach((field) => {
        const fid = field.id;
        let viewer = form.querySelector(
          `div.mini-viewer[data-field-name="${fid}"]`
        );
        viewer.setAttribute("data-composite-unit", String(unit));
        let sub_schema = field.minischema;
        let empty_simple_subfields = sub_schema.fields.filter((subfield) => {
          let not_object = subfield.type != "object";
          let is_not_annotated = !(`${prefix}.${fid}` in annotated_data);
          return not_object && is_not_annotated;
        });
        empty_simple_subfields.forEach((subfield) => {
          let flattened_name = `${prefix}.${fid}.${subfield.id}`;
          viewer
            .querySelectorAll(`[name="${flattened_name}"]`)
            .forEach((child) => (child.name = `${flattened_name}__${unit}`));
        });
        SchemaForm.prepare_objects(
          sub_schema,
          annotated_data,
          viewer,
          `${prefix}.${fid}`,
          `${unit}.1`
        );
      });
  }

  static field_replicator(field, small_div, active) {
    let icon = Field.quick("i", "bi bi-front px-2");
    // for annotation, create a button
    let button = Field.quick("button", "btn btn-outline-dark p-0 mx-2");
    button.type = "button";

    // behavior when the 'repeat' button is clicked
    button.addEventListener("click", () => {
      // clone the div of the field, but instead of the 'repeat' button make a 'remove' button
      let clone = ComplexField.add_field_viewer(field, active);
      let clone_button = clone.querySelector("button i.bi-front").parentElement;
      let new_button = Field.quick("button", "btn btn-outline-dark p-0 mx-2");
      new_button.type = "button";
      let new_icon = Field.quick("i", "bi bi-trash px-2");
      new_button.appendChild(new_icon);
      new_button.addEventListener("click", () => {
        clone.remove();
      });
      clone_button.parentElement.replaceChild(new_button, clone_button);

      let existing_siblings = [...small_div.parentElement.childNodes].filter(
        (child) =>
          child.getAttribute("data-field-name") ==
          small_div.getAttribute("data-field-name")
      );

      if (field.type == "object") {
        let current_unit = small_div.getAttribute("data-composite-unit");
        let split_unit = current_unit.split(".");
        let existing_unit_suffixes = existing_siblings
          .map((child) =>
            parseInt(child.getAttribute("data-composite-unit").split(".").pop())
          )
          .sort();
        let largest_suffix = existing_unit_suffixes.pop();
        split_unit.pop();
        split_unit.push(String(largest_suffix + 1));
        let new_unit = split_unit.join(".");
        clone.setAttribute("data-composite-unit", new_unit);
        // add the cloned div after the last one of its kind
        let last_sibling = existing_siblings[existing_siblings.length - 1];
        if (last_sibling.nextSibling == undefined) {
          last_sibling.parentElement.appendChild(clone);
        } else {
          last_sibling.parentElement.insertBefore(
            clone,
            last_sibling.nextSibling
          );
        }

        function update_children_names(composite_field, subform, new_unit) {
          const direct_children = [
            ...subform.querySelector("div.input-view").childNodes,
          ];
          direct_children.forEach((child, i) => {
            const field_data = composite_field.minischema.fields[i];
            if (field_data.type != "object") {
              const inputs = child.querySelectorAll("input,select");
              inputs.forEach((input) => {
                input.name = `${field_data.name}__${new_unit}`;
                field_data.activate_autocomplete();
                field_data.read_autocomplete();
              });
            } else {
              const sub_unit = new_unit + ".1";
              child.setAttribute("data-composite-unit", sub_unit);
              update_children_names(field_data, child, sub_unit);
            }
          });
        }
        update_children_names(field, clone, new_unit);

        let inner_repeatables = [...clone.childNodes]
          .filter((subfield) => subfield.classList.contains("mini-viewer"))
          .filter((subfield) => subfield.querySelector("button i.bi-front"));
        // NOTE this is not good at dealing with nested composite fields yet!
        inner_repeatables.forEach((subfield) => {
          let subfield_data =
            field.minischema.fields[subfield.getAttribute("data-field-name")];
          let old_button =
            subfield.querySelector("button i.bi-front").parentElement;
          let new_button = SchemaForm.field_replicator(subfield_data, subfield);
          subfield.querySelector("label").replaceChild(new_button, old_button);
        });
      } else {
        let old_name = small_div.querySelector("[name]").name;
        clone.querySelector("[name]").name = old_name;
      }
    });
    button.appendChild(icon);
    return button;
  }

  /**
   * Recursive function that assigns a `name` property to each field with the flattened id.
   * @static
   * @param {SchemaForm|ObjectEditor} object_editor Schema or mini-schema for a composite field.
   * @param {String} flattened_id Prefix to be added to the id of a field.
   */
  static flatten_object(object_editor, flattened_id) {
    object_editor.fields.forEach((field) => {
      // flatten the id
      let subfield_flattened = `${flattened_id}.${field.id}`;
      // if the field is composite, apply this to each field inside
      if (field.constructor.name == "ObjectInput") {
        SchemaForm.flatten_object(field.minischema, subfield_flattened);
      } else {
        // assign the flattened id as a name
        field.name = subfield_flattened;
      }
    });
  }
}
