/**
 * Master class to represent schemas and mini-schemas. Only the child classes are actually instantiated.
 * @property {String} modal_id ID of the modal through which a new input field can be chosen.
 * @property {String} initial_name Placeholder name for DOM element IDs.
 * @property {String} title User-facing label of the schema (or composite field).
 * @property {String} data_status Derived status used for IDs of DOM elements, e.g. 'new', 'copy', 'draft'...
 * @property {Object<String,InputField>} initials Collection of empty fields to start creating.
 * @property {TypedInput} initials.typed Initial simple field.
 * @property {SelectInput} initials.select Initial single-value multiple-choice field.
 * @property {CheckboxInput} initials.checkbox Initial multiple-value multiple-choice field.
 * @property {ObjectInput} initials.object Initial composite field.
 * @property {String[]} field_ids Ordered names of the fields.
 * @property {Object<String,InputField>} fields Collection of fields that belong to the schema.
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
    this.modal_id = `choice-${name}-${data_status}`;
    this.initial_name = name;
    this.data_status = data_status;

    // empty fields to start with
    this.initials = {
      typed: new TypedInput(name, this.data_status),
      select: new SelectInput(name, this.data_status),
      checkbox: new CheckboxInput(name, this.data_status),
      object: new ObjectInput(name, this.data_status),
    };

    // initial state before adding any fields
    this.field_ids = [];
    this.fields = {};
    this.new_field_idx = 0;
  }

  /**
   * Collect the Object-version of the fields into the `properties` property to save as JSON.
   */
  fields_to_json() {
    this.properties = {};
    this.field_ids.forEach((field_id) => {
      this.properties[field_id] = this.fields[field_id].json;
    });
  }

  /**
   * Capture data from the JSON representation of a schema.
   * @param {SchemaContents} data JSON representation of a schema
   */
  from_json(data) {
    // The ID of the schema is coded as `schema_name` for the schemas
    // In the case of composite fields, we take the title instead (it doesn't really matter)
    this.name = data.schema_name || data.title;
    this.title = data.title;
    this.field_ids = Object.keys(data.properties);
    this.status = data.status; // only relevant for Schema class
    this.data_status = this.set_data_status();

    this.field_ids.forEach((field_id) => {
      let new_field = InputField.choose_class(
        this.initial_name,
        this.data_status,
        [field_id, data.properties[field_id]]
      );
      new_field.create_form();
      new_field.create_modal(this);
      this.fields[field_id] = new_field;
    });
  }

  /**
   * Add new fields based on uploaded JSON file.
   * @param {FieldInfo} data JSON representation of a field.
   */
  add_fields_from_json(data) {
    Object.keys(data).forEach((field_id) => {
      let new_field = InputField.choose_class(
        this.initial_name,
        this.data_status,
        [field_id, data[field_id]]
      );
      new_field.create_form();
      new_field.create_modal(this);
      this.add_field(new_field);
      this.new_field_idx = this.new_field_idx + 1;
    });
    bootstrap.Modal.getOrCreateInstance(
      document.getElementById(this.modal_id)
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
    this.data_status = this.set_data_status(); // to make sure it's correct (but maybe this is redundant)

    // create a div to fill in with the different field examples
    let formTemp = Field.quick("div", "formContainer");
    formTemp.id = this.data_status + "-templates";

    // create the modal and add the div
    let form_choice_modal = new Modal(
      this.modal_id,
      "What form element would you like to add?"
    );
    form_choice_modal.create_modal([formTemp], "lg");

    // when the modal is first shown, render all the initial fields
    let this_modal = document.getElementById(this.modal_id);
    this_modal.addEventListener("show.bs.modal", () => {
      let formTemp = this_modal.querySelector("div.formContainer");
      let from_json_load = InputField.from_json_example(this);
      if (formTemp.childNodes.length == 0) {
        Object.values(this.initials).forEach((initial) => {
          initial.schema_status = this.data_status;
          formTemp.appendChild(initial.render(this));
        });
        formTemp.appendChild(from_json_load);
      } else {
        formTemp.replaceChild(from_json_load, formTemp.lastChild);
      }
    });
    if (this.constructor.name == "ObjectEditor") {
      this_modal.addEventListener("hidden.bs.modal", () => {
        bootstrap.Modal.getOrCreateInstance(
          document.getElementById(this.card_id)
        ).show();
      });
    }
  }

  /**
   * Create a MovingViewer for a field and add it to the editing section of the (mini-)schema.
   * @param {InputField} form_object Field belonging to this schema.
   */
  view_field(form_object) {
    // identify the DOM element where the moving viewer will be inserted
    let form = this.form_div;
    if (form == undefined) {
      return;
    }

    // select the button that (supposedly, not necessarily) was used to add this field
    let clicked_button = form.querySelectorAll(".adder")[this.new_field_idx];

    // select whatever is currently under the 'clicked' button
    let below = clicked_button.nextSibling;

    // obtain the MovingViewer of the field and create a new button for it (to add things under it)
    let moving_viewer = form_object.view(this);
    moving_viewer.below = this.create_button();

    // add both the MovingViewer and its button after the clicked button
    below.parentElement.insertBefore(moving_viewer.div, below);
    below.parentElement.insertBefore(moving_viewer.below, below);

    // disable/re-enable the buttons of the existing viewers
    let viewers = below.parentElement.querySelectorAll(".viewer");

    // if this new field is in the first place
    if (this.new_field_idx === 0) {
      // disable its up-button
      moving_viewer.up.setAttribute("disabled", "");

      // re-enable the up-button of the field that was first before, if relevant
      if (viewers.length > 1) {
        viewers[1].querySelector(".up").removeAttribute("disabled");
      }
    }

    // if this new field is in the last place
    if (this.new_field_idx === this.field_ids.length - 1) {
      // disable its down-button
      moving_viewer.down.setAttribute("disabled", "");

      // re-enable the down-button of the field that was last before, if relevant
      if (viewers.length > 1) {
        viewers[viewers.length - 2]
          .querySelector(".down")
          .removeAttribute("disabled");
      }
    }
  }

  /**
   * Add a new field to the (mini-)schema.
   * @param {InputField} form_object Field to be added to this schema.
   */
  add_field(form_object) {
    // Add the field ID to the list of field IDs, in the right order
    this.field_ids.splice(this.new_field_idx, 0, form_object.id);

    // Add the field to the object with fields
    this.fields[form_object.id] = form_object;

    // Enable or disable 'saving' the schema based on whether this field has been created by duplicating.
    this.toggle_saving();

    // Create the MovingViewer and add it to the editing section of the schema
    this.view_field(form_object);
  }

  /**
   * Update an existing field in a schema.
   * @param {InputField} form_object Field to be updated.
   */
  update_field(form_object) {
    // Replace the field in this.fields
    this.fields[form_object.id] = form_object;

    // Identify the form with MovingViewers and the MovingViewer itself
    let form = this.form_div;
    let viewer = form.querySelector("#" + form_object.id);

    // Update the title of the MovingViewer
    viewer.querySelector("h5").innerHTML = form_object.required
      ? form_object.title + "*"
      : form_object.title;
    let rep_icon = Field.quick("i", "bi bi-front px-2");
    if (form_object.repeatable) {
      viewer.querySelector("h5").appendChild(rep_icon);
    } else if (viewer.querySelector("h5 .bi-front") != null) {
      viewer.querySelector("h5").removeChild(rep_icon);
    }

    // Replace the contents of the MovingViewer
    let form_field = viewer.querySelector(".card-body");
    let new_input = form_object.viewer_input();
    form_field.replaceChild(new_input, form_field.firstChild);
    if (form_object.constructor.name == "ObjectInput") {
      let help_div = form_field.querySelector(".form-text#help-composite");
      if (help_div) {
        if (form_object.help) {
          help_div.innerHTML = form_object.help;
        } else {
          help_div.remove();
        }
      } else if (form_object.help) {
        let description = Field.quick(
          "p",
          "form-text mt-0 mb-1",
          form_object.help
        );
        description.id = "help-composite";
        form_field.insertBefore(description, new_input);
      }
    }
  }

  /**
   * Replace (rename) an existing field in a schema.
   * @param {String} old_id ID of the field to be replaced.
   * @param {InputField} form_object Replacement field.
   */
  replace_field(old_id, form_object) {
    // Identify the form with MovingViewers
    let form = this.form_div;

    // Identify the button under the field that we want to replace and remove it along with the MovingViewer on top of it
    const old_adder =
      form.querySelectorAll(".adder")[this.field_ids.indexOf(old_id) + 1];
    old_adder.previousSibling.remove();
    old_adder.remove();

    // Remove the existing field from this.fields and from this.field_ids
    delete this.fields[old_id];
    this.new_field_idx = this.field_ids.indexOf(old_id); // set next-field index to the index of the replaced field
    this.field_ids.splice(this.new_field_idx, 1);

    // Add the replacement field
    this.add_field(form_object);
  }

  /**
   * Disable or enable saving a (mini-)schema based on whether any of the existing fields is a duplicate.
   * Duplicates don't have ids, so we cannot save a schema until that issue is resolved.
   */
  toggle_saving() {
    // Identify the form with moving viewers
    let form = this.form_div;

    // Check if any field is a duplicate
    const has_duplicates = Object.values(this.fields).some(
      (field) => field.is_duplicate
    );

    // Buttons to update:
    const buttons =
      this.constructor.name == "Schema"
        ? ["publish", "draft"].map((btn) => form.querySelector("button#" + btn)) // publish and draft for schemas
        : [form.querySelector("button#add")]; // "add/update" for a composite field
    if (has_duplicates) {
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
    let div = Field.quick("div", "d-grid gap-2 adder mt-2");
    let button = Field.quick("button", "btn btn-primary btn-sm", "Add element");
    button.type = "button";
    // attach button to modal
    button.setAttribute("data-bs-toggle", "modal");
    button.setAttribute("data-bs-target", `#${this.modal_id}`);

    // on click, the modal will also update `new_field_idx` based on the index of the field on top of it
    button.addEventListener("click", () => {
      this.new_field_idx = div.previousSibling.classList.contains("viewer")
        ? this.field_ids.indexOf(div.previousSibling.id) + 1
        : 0;
    });

    div.appendChild(button);
    return div;
  }

  /**
   * Reset the contents of this schema: no fields, initial name
   */
  reset() {
    this.field_ids = [];
    this.fields = {};
    this.new_field_idx = 0;

    // if relevant, reset the name
    // if this is the initial schema and a new draft has been created
    if (this.constructor.name == "Schema" && this.status == "draft") {
      this.name = "schema-editor"; // then the name should be 'schema-editor'
    } else if (this.parent) {
      // if this is the clone of another schema
      this.name = this.parent.match(/(.+)-\d\.\d\.\d/)[1]; // get the name of the parent (no versions)
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
      schema.constructor.name == "SchemaForm"
        ? Field.quick("form", "mt-3 needs-validation")
        : Field.quick("div", "input-view");

    // go through each of the fields
    // QUESTION should the code inside the forEach be defined in the InputField classes?
    schema.field_ids.forEach((field_id) => {
      let subfield = ComplexField.add_field_viewer(
        schema.fields[field_id],
        active
      );
      div.appendChild(subfield);
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
    delete this.initials;
    this.field_ids = ["text", "date", "hair"];

    // Create a simple field of type 'text' for illustration
    let name = new TypedInput(schema_name);
    name.id = "text";
    name.title = "Full name";
    name.value = "Jane Doe";
    this.fields.text = name;

    // Create a simple field of type 'date' for illustration
    let bday = new TypedInput(schema_name);
    bday.type = "date";
    bday.title = "Birth date";
    bday.value = "1970-05-03";
    this.fields.date = bday;

    // Create a single-value multiple-choice field for illustration
    let hair = new SelectInput(schema_name);
    hair.name = "hair";
    hair.values.values = ["brown", "red", "blond", "dark", "pink"];
    hair.value = "red";
    hair.title = "Hair color";
    this.fields.hair = hair;
  }
}

/**
 * Class for mini-schemas connected to a composite field.
 * `data_status` always starts with 'object', followed by the `data_status`
 * of the schema that the composite field belongs to.
 * @extends ComplexField
 * @property {String} parent_status `data_status` of the (mini-)schema the composite field belongs to.
 * @property {String} form_id ID of the editing form of the composite field this is linked to.
 * @property {String} card_id ID of the editing modal of the composite field this is linked to. Assigned by `ObjectInput.create_modal()`.
 */
class ObjectEditor extends ComplexField {
  /**
   * Create a mini-schema for a composite field.
   * @param {ObjectInput} parent Composite field this mini-schema is linked to.
   */
  constructor(parent) {
    super(parent.id, `object-${parent.schema_status}`);
    this.parent_status = parent.schema_status;
    if (parent.form_field) {
      this.form_id = parent.form_field.form.id;
    }
    delete this.initials.object; // disable nested composite fields
  }

  /**
   * Create a button to add more fields.
   * @returns {HTMLDivElement} A DIV with a button.
   */
  get button() {
    return this.create_button();
  }

  /**
   * Get the form with the moving viewers of the fields.
   * @return {HTMLFormElement}
   */
  get form_div() {
    return document.querySelector(`.modal#${this.card_id} form`);
  }

  /**
   * Obtain the data_status of the mini-schema.
   * @returns {String} Derived status as used in IDs for DOM elements.
   */
  set_data_status() {
    return `object-${this.parent_status}`;
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
    this.name = card_id.match(/^(.*)-\d\d\d$/)[1];
    this.version = version;
    this.container = container_id;
    this.urls = urls;
  }

  /**
   * Get the form with the moving viewers of the fields.
   * @return {HTMLFormElement}
   */
  get form_div() {
    return document.querySelector(
      `form#form-${this.card_id}-${this.data_status}`
    );
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
  }

  /**
   * Create an editing form for this schema. The form contains
   * - a field to provide a name (read-only if a draft has been saved)
   * - a field to provide a user-facing title/label (read-only if a version has been published)
   * - one or more buttons to add fields, and MovingViewers if there are fields already
   * - submission buttons
   */
  create_editor() {
    // create a form with hidden fields for submission
    let form = new SchemaDraftForm(this);

    // define if this is the first draft of a schema and it has never been saved
    let is_new =
      this.data_status == "copy" || this.card_id.startsWith("schema-editor");

    // create and add an input field for the ID (or 'name')
    form.add_input("Schema ID", this.card_id + "-name", {
      placeholder: "schema-name",
      validation_message:
        "This field is compulsory, please only use lower case letters or numbers, '_' and '-'. Existing IDs cannot be reused.",
      pattern: schema_pattern,
      description: is_new
        ? "This cannot be changed after the draft is saved."
        : false,
    });
    const name_input = form.form.querySelector(`#${this.card_id}-name`);
    name_input.name = "schema_name";

    // create and add an input field for the user-facing label/title
    form.add_input("Schema label", this.card_id + "-label", {
      placeholder: "Some informative label",
      validation_message: "This field is compulsory.",
      description: is_new
        ? "This cannot be changed once a version has been published."
        : false,
    });
    const title_input = form.form.querySelector(`#${this.card_id}-label`);
    title_input.name = "title";

    // create and add the first button to add fields
    let button = this.create_button();
    form.form.insertBefore(button, form.divider);

    // create and add a submission button that saves the draft without publishing
    form.add_action_button("Save draft", "draft");
    form.add_submit_action("draft", (e) => {
      // BS5 validity check
      if (!form.form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        form.form.classList.add("was-validated");
      } else {
        this.save_draft("save");
        form.form.classList.remove("was-validated");
      }
    });

    // create and add a submission button that publishes the draft
    form.add_action_button("Publish", "publish", "warning");
    form.add_submit_action("publish", (e) => {
      e.preventDefault();
      // BS5 validity check
      if (!form.form.checkValidity()) {
        e.stopPropagation();
        form.form.classList.add("was-validated");
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
        form.form.classList.remove("was-validated");
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
    if (this.field_ids.length == 0) {
      form.form.querySelector("button#publish").setAttribute("disabled", "");
    }

    this.form = form;
  }

  /**
   * For clones: fill a clone Schema based on the contents of its parent.
   * @param {Schema} parent Schema of the parent.
   */
  from_parent(parent) {
    this.field_ids = [...parent.field_ids]; // duplicate field ids
    this.parent = `${parent.name}-${parent.version}`; // register name and version of the parent
    this.initial_name = `${parent.name}-new`;
    this.status = "draft"; // start as draft (but data_status will be 'copy')
    this.origin = {
      ids: [...parent.field_ids],
      json: { ...parent.properties },
    };
    // go through each existing field and clone it
    Object.entries(parent.properties).forEach((entry) => {
      let new_field = InputField.choose_class(
        this.initial_name,
        "child",
        entry
      );
      new_field.create_form();
      new_field.create_modal(this);
      this.fields[entry[0]] = new_field;
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
    this.child.from_parent(this);
  }

  prepare_json_download() {
    if (this.field_ids.length == 0) {
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
    let viewer = ComplexField.create_viewer(this);
    this.nav_bar.add_tab_content("view", viewer);

    if (this.status == "draft") {
      // add button and tab for editing the schema
      this.nav_bar.add_item("edit", "Edit");

      // create the modal to show the options for new fields
      this.display_options();

      // create the editing form
      this.create_editor();
      // fill in the name and titles
      this.form.form.querySelector('[name="schema_name"]').value = this.name; // id
      this.form.form.querySelector('[name="title"]').value = this.title; // label

      // add the new form to the 'edit' tab
      this.nav_bar.add_tab_content("edit", this.form.form);

      // add a json view
      this.prepare_json_download();

      // add and define 'discard' button
      this.nav_bar.add_action_button("Discard", "danger", () => {
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
      });
    } else if (this.status == "published") {
      // create modal and form for a new draft
      this.draft_from_publish();

      // initalize a new schema as child/clone and create its modal and form
      this.setup_copy();
      this.child.display_options(); // create field-choice modal
      this.nav_bar.add_item("child", "Copy to new schema"); // add to tabs
      this.child.create_editor(); // create form
      this.nav_bar.add_tab_content("child", this.child.form.form); // add form to tab

      // add a json view
      this.prepare_json_download();

      // add and define the 'archive' button
      this.nav_bar.add_action_button("Archive", "danger", () => {
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
      });
    }
  }

  /**
   * Set up an editor for a draft from a published version
   */
  draft_from_publish() {
    // only if there are no existing drafts
    if (schemas[this.name].draft.length == 0) {
      this.display_options(); // create field-choice modal
      this.nav_bar.add_item("new", "New (draft) version", false, 1); // create tab
      this.create_editor(); // create form

      // fill in name and title
      this.form.form.querySelector('[name="schema_name"]').value = this.name; // id
      this.form.form.querySelector('[name="title"]').value = this.title; // label

      this.nav_bar.add_tab_content("new", this.form.form); // add form to tab
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

    // show a message if there are no fields
    if (this.field_ids.length == 0) {
      let msg = Field.quick(
        "div",
        "viewer",
        'This schema does not have any fields yet. Go to "edit" mode to add one.'
      );
      this.nav_bar.tab_content.querySelector(".input-view").appendChild(msg);
    }

    // show all existing fields
    this.field_ids.forEach((field_id, idx) => {
      this.new_field_idx = idx;
      this.view_field(this.fields[field_id]); // show in editor
      if (this.status == "published") {
        this.child.new_field_idx = idx; // show the fields in the clone editor
        this.child.view_field(this.child.fields[field_id]);
      }
    });
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
  constructor(name, title, versions, container_id, urls) {
    this.name = name;
    this.title = title;
    this.versions = versions;

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
    schema.loaded = false;
    // create an HTTP request for this schema
    let reader = new TemplateReader(
      this.urls.get.replace("status", version.status),
      schema
    ); // url to get this template

    const accordion = nav_bar.tab_content.parentElement.parentElement;
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
 * @property {String[]} field_ids Ordered list of IDs of the fields.
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

    // Initialized empty set of fields
    this.fields = {};
    this.field_ids = Object.keys(json.properties);

    // create the form and add the fields
    this.from_json(json.properties);
  }

  /**
   * Create the form with all its fields.
   * @param {Object<String,FieldInfo>} schema_json Collection of Object-versions of fields.
   */
  from_json(schema_json) {
    // Go through each field in the JSON file and create its InputField
    for (let entry of Object.entries(schema_json)) {
      // the 'data_status' argument is not relevant here
      let new_field = InputField.choose_class(this.name, "", entry);
      if (new_field.constructor.name == "ObjectInput") {
        new_field.editor = new ObjectEditor(new_field);
        new_field.editor.from_json(new_field.json_source);
      }
      this.fields[entry[0]] = new_field;
    }

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

    // Include BS5 validation
    form_div.addEventListener("submit", (e) => {
      if (!form_div.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form_div.classList.add("was-validated");
    });

    document.getElementById(this.container).appendChild(form_div);
    this.form = form_div;
  }

  /**
   * Fill in the form with existing metadata.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   */
  add_annotation(annotated_data) {
    // add a hidden field withthe value of 'redirect_route
    let hidden_input = document.createElement("input");
    hidden_input.type = "hidden";
    hidden_input.name = "redirect_route";
    hidden_input.value = annotated_data.redirect_route[0];
    this.form.appendChild(hidden_input);

    // exclude non-metadata keys, e.g. 'redirect_route'
    let keys = Object.keys(annotated_data).filter(
      (x) => x.startsWith(this.prefix) && !x.endsWith("__version__")
    );

    // extract fields that are not in composite fields and register them
    let non_objects = keys.filter(
      (fid) => typeof annotated_data[fid][0] != "object"
    );
    non_objects.forEach((fid) => this.register_non_object(fid, annotated_data));

    // extract fields that are in composite fields
    let objs = keys.filter((fid) => typeof annotated_data[fid][0] == "object");
    // identify the unique composite fields
    // go through each composite field and register its subfields
    objs.forEach((fid) => this.register_object(fid, annotated_data));

    SchemaForm.prepare_objects(this, annotated_data, this.form, this.prefix);
  }

  /**
   * Retrieve the annotated data corresponding to fields inside a given composite field.
   * @param {String} obj Flattened ID of the composite field.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   * @param {String} prefix Prefix common to all these fields.
   * @param {HTMLFormElement|HTMLDivElement} form Form or div element inside which we can find the input field to fill in.
   */
  register_object(obj, annotated_data, prefix = null, form = null) {
    // Start with the original prefix, but accumulate when we have nested composite fields
    prefix = prefix || this.prefix;
    form = form || this.form;

    // Identify the fields that belong to this particular composite fields
    let existing_values = annotated_data[obj];
    let raw_name = obj.match(`${prefix}.(?<field>[^\.]+)`).groups.field;
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
    first_viewer
      .querySelectorAll("[name]")
      .forEach(
        (subfield) => (subfield.name = `${subfield.name}__${first_unit}`)
      );
    if (existing_values.length > 1) {
      for (let i = 0; i < existing_values.length - 1; i++) {
        first_viewer.querySelector("h5 button").click();
      }
    } else if (!("__unit__" in existing_values[0])) {
      existing_values[0]["__unit__"] = ["1"];
    }
    existing_values.forEach((object) => {
      let unit = object.__unit__[0];
      let viewer = [...form.childNodes].filter(
        (child) =>
          child.classList.contains("mini-viewer") &&
          child.getAttribute("data-field-name") == raw_name &&
          child.getAttribute("data-composite-unit") == String(unit)
      )[0];

      // Extract the fields that are not inside nested composite fields and register them
      let not_nested = Object.keys(object).filter(
        (fid) => typeof object[fid][0] != "object" && fid != "__unit__"
      );
      not_nested.forEach((fid) => {
        this.register_non_object(fid, object, viewer);
      });

      // Extract the fields that are inside nested composite fields
      let nested = Object.keys(object).filter(
        (fid) => typeof object[fid][0] == "object"
      );

      // Go through each nested composite field and register its subfields, with an accumulated prefix
      nested.forEach((fid) => this.register_object(fid, object, obj, viewer));
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
    form = form || this.form;

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
      for (let i = 0; i < existing_values.length - 1; i++) {
        first_input.querySelector("label button").click();
      }
      form.querySelectorAll(`[name="${input_name}"]`).forEach((input, i) => {
        input.value = existing_values[i];
      });
    }
  }

  static prepare_objects(
    object_editor,
    annotated_data,
    form,
    prefix,
    unit = 1
  ) {
    let empty_composite_fields = object_editor.field_ids.filter((fid) => {
      let is_object = object_editor.fields[fid].type == "object";
      let is_not_annotated =
        Object.keys(annotated_data).indexOf(`${prefix}.${fid}`) == -1;
      return is_object && is_not_annotated;
    });
    empty_composite_fields.forEach((fid) => {
      let viewer = form.querySelector(
        `div.mini-viewer[data-field-name="${fid}"]`
      );
      viewer.setAttribute("data-composite-unit", String(unit));
      let sub_schema = object_editor.fields[fid].editor;
      let simple_subfields = sub_schema.field_ids.filter(
        (subfid) => sub_schema.fields[subfid].type != "object"
      );
      simple_subfields.forEach((subfid) => {
        let flattened_name = `${prefix}.${fid}.${subfid}`;
        viewer.querySelector(
          `[name="${flattened_name}"]`
        ).name = `${flattened_name}__${unit}`;
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
        clone
          .querySelectorAll("[name]")
          .forEach(
            (subfield) => (subfield.name = `${subfield.name}__${new_unit}`)
          );
        clone.querySelectorAll("[data-composite-unit]").forEach((subfield) => {
          let current_subunit = subfield.getAttribute("data-composite-unit");
          let new_subunit = current_subunit.replace(
            new RegExp(`^${current_unit}`),
            new_unit
          );
          subfield.setAttribute("data-composite-unit", new_subunit);
        });
        let inner_repeatables = [...clone.childNodes]
          .filter((subfield) => subfield.classList.contains("mini-viewer"))
          .filter((subfield) => subfield.querySelector("button i.bi-front"));
        // NOTE this is not good at dealing with nested composite fields yet!
        inner_repeatables.forEach((subfield) => {
          let subfield_data =
            field.editor.fields[subfield.getAttribute("data-field-name")];
          let old_button =
            subfield.querySelector("button i.bi-front").parentElement;
          let new_button = SchemaForm.field_replicator(subfield_data, subfield);
          subfield.querySelector("label").replaceChild(new_button, old_button);
        });
      } else {
        let old_name = small_div.querySelector("[name]").name;
        clone.querySelector("[name]").name = old_name;
      }

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
    // go through each field
    object_editor.field_ids.forEach((field_id) => {
      // flatten the id
      let subfield_flattened = `${flattened_id}.${field_id}`;
      // if the field is composite, apply this to each field inside
      if (object_editor.fields[field_id].constructor.name == "ObjectInput") {
        SchemaForm.flatten_object(
          object_editor.fields[field_id].editor,
          subfield_flattened
        );
      } else {
        // assign the flattened id as a name
        object_editor.fields[field_id].name = subfield_flattened;
      }
    });
  }
}
