/**
 * Representation of a field to be saved as JSON.
 * @typedef {Object} FieldInfo
 * @property {String} title User-facing label of the field, to be printed in the form and the rendering.
 * @property {String} type Type of input, to be defined in the specific class or among choices for a simple field.
 * @property {Boolean} [required] Whether the field will be required in the form.
 * @property {String} [default] If the field is required (and even then, optionally), the default value in the field.
 * @property {Boolean} [repeatable] For simple fields, whether the field can be repeated in the form.
 * @property {String} [minimum] For simple fields with numeric type, the minimum possible value.
 * @property {String} [maximum] For simple fields with numeric type, the maximum possible value.
 * @property {Boolean} [multiple] For multiple-choice fields, whether only multiple values can be chosen.
 * @property {String} [ui] For multiple-choice fields, whether the field is rendered as "dropdown", "checkbox" or "radio".
 * @property {String[]} [values] For multiple-choice fields, the list of options.
 * @property {Object} [properties] For composite fields, the collection of subfields.
 */

/**
 * Master class to represent input fields. Only the child classes are actually instantiated.
 * @property {String} id Identifier of the field in relation to other fields, used in the DOM elements related to it. It matches `field_id` unless the field is new.
 * @property {String} field_id ID of the field as it will show in the "ID" input field of the editing form (empty if it has not been defined).
 * @property {String} form_type Internal type to distinguish different subclasses in the DOM IDs.
 * @property {String} description Description to show in the example of the options viewer. For now an empty string except in composite fields.
 * @property {String} dummy_title Title for the example in the options viewer. Always "Informative label".
 * @property {String} mode In first instance, "add"; when an existing field can be edited, "mod".
 * @property {Boolean} is_duplicate Whether the field has just been created via duplication of a different field.
 * @property {String} schema_name Name of the schema the field belongs to.
 * @property {String} schema_status Derived status of the schema as it is used in the ID of the form ('new', 'draft', 'copy' or 'object...').
 * @property {Boolean} required Whether the field should be required when implementing the metadata.
 * @property {Boolean} repeatable Whether the field can be repeated in the implementation form.
 * @property {Object} values Variable properties specific to different kinds of fields.
 * @property {String|Number} default Default value of the field, if the field is required.
 * @property {BasicForm} form_field Form to edit the contents of the field.
 * @property {bootstrap.Modal} modal Modal to which the editing form is attached.
 * @property {String} button_title User-facing of the type of form.
 */
class InputField {
  /**
   * Initialize a new Field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    // Strings for the example
    this.description = "";
    this.dummy_title = "Informative label";

    // Attributes to limit some behavior
    this.mode = "add";
    this.is_duplicate = false;

    // Info about the field contents
    this.required = false;
    this.repeatable = false;
    this.values = {};
    this.help = "";
    this.help_is_custom = false;

    // Schema information
    this.schema_name = schema_name;
    this.schema_status = data_status;
  }

  /**
   * Retrieve the contents in JSON format for form submission.
   * @returns {FieldInfo} JSON representation of the contents of the field.
   */
  get json() {
    return this.to_json();
  }

  /**
   * Turn the relevant fields into an Object to be saved in a JSON file.
   * @returns {FieldInfo} JSON representation of the contents of the field.
   */
  to_json() {
    // always include the title and type, expand whatever values are in this field
    let json = { title: this.title, type: this.type, ...this.values };

    // add required, default and repeatable fields if relevant
    if (this.required) {
      json.required = this.required;
      if (this.default) json.default = this.default;
    }
    if (this.repeatable) json.repeatable = this.repeatable;
    if (this.help) {
      json.help = this.help;
    }

    return json;
  }

  /**
   * Parse an object to fill in the properties of the object instance.
   * @param {FieldInfo} data JSON representation of the contents of the field.
   */
  from_json(data) {
    this.title = data.title;
    this.type = data.type;
    if (data.required) {
      this.required = data.required;
      if (data.default) {
        this.default = data.default;
      }
    }
    if (data.repeatable) {
      this.repeatable = data.repeatable;
    }
    if (data.help) {
      this.help = data.help;
      this.help_is_custom = true;
    }
  }

  /**
   * Process the data from a JSON file with fields and add an event to the 'Load' button to add them to a schema.
   * @param {HTMLDivElement} json_div Box with messages and text for loading fields from JSON.
   * @param {String} data The result of reading the JSON file.
   * @param {Schema} schema Schema to which the fields would be added.
   */
  static verify_json_data(json_div, data, schema) {
    let json_example = json_div.querySelector("pre"); // verbatim section that shows the JSON contents
    let json_summary = json_div.querySelector("#load-summary"); // box where success/warning/error message will show up
    let json_summary_color = [...json_summary.classList].filter((x) =>
      x.startsWith("text-bg-")
    )[0];
    let load_button = json_div.querySelector("button"); // button to load from JSON
    let new_button = Field.quick(
      "button",
      "btn btn-success",
      "<strong>Load from JSON</strong>"
    );
    new_button.setAttribute("disabled", "");
    json_div.replaceChild(new_button, load_button); // reset the button in case many files are checked before loading

    try {
      // see if the JSON can be parsed at all
      let new_fields = JSON.parse(data);
      if (new_fields.constructor.name == "Object") {
        // if it's a JSON and has the correct type
        if (
          !Object.values(new_fields).every(
            (f) => f.constructor.name == "Object"
          ) && // not all eelemnts are objects
          "properties" in new_fields // it has a properties attribute
        ) {
          new_fields = new_fields.properties;
        }

        let errors = [],
          warnings = [];
        let errors_field = "",
          warnings_field = "";
        let original_fields = Object.keys(new_fields).length;

        // go through each field in the object and validate it
        for (let field of Object.entries(new_fields)) {
          const { messages: new_msg, ok: new_ok } = InputField.validate_class(
            field[1]
          );
          if (!new_ok) {
            // if the field is not valid at all
            delete new_fields[field[0]];
            errors.push(
              `<p class="text-danger fw-bold m-0">The field '${field[0]}' was deleted because it was not in order.</p>`
            );
            errors = [...errors, ...new_msg];
          } else {
            let field_name = field[0];
            while (schema.field_ids.indexOf(field_name) > -1) {
              field_name = field_name + "-new";
            }
            // if the name already exists (and was therefore changed)
            if (field[0] != field_name) {
              new_fields[field_name] = { ...field[1] };
              delete new_fields[field[0]];
              warnings.push(
                `<p class="text-warning fw-bold m-0">The field '${field[0]}' was renamed to '${field_name}' because '${field[0]}' already exists, and moved to the end.</p>`
              );
            }
            if (new_msg.length > 0) {
              warnings.push(
                `<p class="text-warning fw-bold m-0">The field '${field_name}' was modified.</p>`
              );
              warnings = [...warnings, ...new_msg];
            }
          }
        }

        // write up a box with error messages if there are any (=fields that were discarded)
        if (errors.length > 0) {
          let errors_list = errors
            .map((x) => (x.startsWith("<") ? x : `<p class="m-0">${x}</p>`))
            .join("");
          errors_field = `<div class="border border-danger px-2 mb-2"><h4 class="text-danger">Errors</h4>${errors_list}</div>`;
        }

        // write up a box with warnings if there are any (=fields that were only modified)
        if (warnings.length > 0) {
          let warnings_list = warnings
            .map((x) => (x.startsWith("<") ? x : `<p class="m-0">${x}</p>`))
            .join("");
          warnings_field = `<div class="border border-warning px-2 mb-2"><h4 class="text-warning">Warnings</h4>${warnings_list}</div>`;
        }
        let final_fields = Object.keys(new_fields).length;

        // prepare the new contents for the <pre> box
        let text_fields = {
          errors: errors_field,
          warnings: warnings_field,
          text: JSON.stringify(new_fields, null, "  "),
        };

        if (final_fields == 0) {
          // if all fields were invalid
          json_summary.classList.replace(json_summary_color, "text-bg-danger");
          json_summary.innerHTML =
            "<strong>ERROR</strong>: The contents of this file are not correct!";
          text_fields.text = JSON.stringify(JSON.parse(data), null, "  ");
        } else {
          // it is possible to load something
          new_button.addEventListener("click", () =>
            schema.add_fields_from_json(new_fields)
          );
          new_button.removeAttribute("disabled", "");
          if (final_fields < original_fields) {
            // some fields were invalid
            json_summary.classList.replace(
              json_summary_color,
              "text-bg-warning"
            );
            json_summary.innerHTML =
              "<strong>WARNING</strong>: Some fields were removed because they were not appropriate, but the rest can be uploaded.";
          } else {
            json_summary.classList.replace(
              json_summary_color,
              "text-bg-success"
            );
            json_summary.innerHTML =
              "<strong>SUCCESS!</strong> This file is correct and the fields can be read!";
          }
        }
        json_example.innerHTML = Object.values(text_fields).join("");
      } else {
        // the JSON was valid but not an object
        json_summary.classList.replace(json_summary_color, "text-bg-danger");
        json_summary.innerHTML =
          "<strong>ERROR</strong>: The uploaded JSON is not an object.";
        json_example.innerHTML = JSON.stringify(new_fields, null, "  ");
      }
    } catch (e) {
      // there was some error
      json_summary.classList.replace(json_summary_color, "text-bg-danger");
      if (e instanceof SyntaxError) {
        // the problem is invalid JSON
        json_summary.innerHTML =
          "<strong>ERROR</strong>: The uploaded file is not valid JSON.";
        json_example.innerHTML = data;
      } else {
        // there was something else
        json_summary.innerHTML = "<strong>UNEXPECTED ERROR</strong>";
        json_example.innerHTML = e;
      }
    }
  }

  /**
   * Create an example with a button to load new fields from JSON.
   * @returns {HTMLDivElement} Box with button to activate a modal and load fields from JSON.
   */
  static from_json_example(schema) {
    let input_id = `choose-json-${schema.name}-${schema.data_status}`;
    const reader = new FileReader();
    reader.onload = () => {
      InputField.verify_json_data(json_div, reader.result, schema);
    };

    let json_div = Field.quick("div", "ex my-2");
    let explanation = Field.quick(
      "p",
      "fst-italic",
      "Extract fields form a JSON file with fields or with a full schema (only the fields will be uploaded!)."
    );
    let button = Field.quick(
      "button",
      "btn btn-outline-primary",
      "<strong>Load from JSON</strong>"
    );
    button.setAttribute("disabled", "");
    let label = Field.quick(
      "label",
      "form-label",
      "Choose a file or drag and drop into the field below."
    );
    label.setAttribute("for", input_id);
    let input = Field.quick("input", "form-control");
    input.id = input_id;
    input.type = "file";
    input.setAttribute("accept", ".json");
    input.addEventListener("change", (e) => {
      reader.readAsText(e.target.files[0]);
    });

    let json_summary = Field.quick(
      "p",
      "text-bg-secondary p-2 mt-2 rounded",
      "No file has been uploaded yet."
    );
    json_summary.id = "load-summary";

    json_div.appendChild(button);
    json_div.appendChild(document.createElement("br"));
    json_div.appendChild(explanation);
    json_div.appendChild(label);
    json_div.appendChild(input);
    json_div.appendChild(json_summary);

    // Example with drag-and-drop
    let json_example = Field.quick("pre", "border p-1 bg-light");
    let example = {
      field_id: {
        title: "Informative label",
        type: "select",
        ui: "radio",
        values: ["one", "two", "three"],
        multiple: false,
      },
    };
    json_example.setAttribute(
      "style",
      "width:700px; white-space: pre-wrap;margin-top:1em;"
    );
    json_example.innerHTML = JSON.stringify(example, null, "  ");
    json_example.addEventListener("dragover", (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    json_example.addEventListener("drop", (e) => {
      e.stopPropagation();
      e.preventDefault();
      reader.readAsText(e.dataTransfer.files[0]);
    });
    json_div.appendChild(json_example);
    let from_json = InputField.example_box(json_div);
    from_json.id = "from_json_container";
    return from_json;
  }

  /**
   * Generate an example of the field for illustration.
   * @returns {HTMLDivElement} An element that contains an optional description, a title and an illustration of what the field looks like in a form.
   */
  create_example() {
    let example = Field.quick("div", "ex my-2", this.description);

    let inner_label = Field.quick("label", "form-label h6", this.dummy_title);

    example.appendChild(inner_label);
    // generate the appropriate illustration of the field (depends on the child classes)
    example.appendChild(this.constructor.ex_input());
    return example;
  }

  /**
   * Create a field to set up a description / help text for the field.
   */
  add_help_field() {
    this.form_field.add_input("Description", `${this.id}-help`, {
      description:
        "Text to show as a description / help text for a field, like this text.",
      required: false,
      as_textarea: true,
      value: this.help,
      placeholder: "Helpful description",
    });
    let help = this.form_field.form.querySelector(`textarea#${this.id}-help`);
    help.addEventListener("change", () => {
      this.help_is_custom = true;
      this.update_help();
    });
  }

  update_help() {
    this.help = "";
  }

  /**
   * Add a field to provide a default value, if relevant.
   * @abstract
   */
  add_default_field() {
    return;
  }

  /**
   * Create a form to edit the field.
   * @abstract
   */
  create_form() {
    return;
  }

  /**
   * Initalize a form to edit the field and add the components at the beginning of the form.
   */
  setup_form() {
    // create a new form
    this.form_field = new BasicForm(this.id);

    // add an input field to provide the ID of the field
    this.form_field.add_input(
      `ID for ${this.form_type} (underlying label)`,
      `${this.id}-id`,
      {
        description:
          "Use lowercase or numbers, no spaces, no special characters other than '_'.",
        value: this.field_id,
        validation_message:
          "This field is compulsory. Use only lowercase, numbers, and '_'.",
        pattern: "[a-z0-9_]+",
      }
    );

    // add an input field to provide the title of the field
    this.form_field.add_input(
      `Label for ${this.form_type} (display name)`,
      `${this.id}-label`,
      {
        description: "This is what an user will see when inserting metadata.",
        value: this.title,
      }
    );
  }

  /**
   * Add the last parts of the form
   * The behavior is more or less subclass-specific, so maybe it can be cleaned up a bit.
   */
  end_form() {
    let this_class = this.constructor.name;

    // Add a field to provide a helpful description
    this.add_help_field();

    // Add a field to provide a default value, if relevant
    this.add_default_field();

    // define whether there should be a dropdown option
    let dropdownable =
      (this_class == "SelectInput") | (this_class == "CheckboxInput");

    // define whether the field may be repeated

    // define whether the field may be required
    let requirable = !(
      (this_class == "CheckboxInput") |
      (this_class == "ObjectInput")
    );

    // generate the list of switches
    let switchnames = requirable ? ["required"] : [];
    let switches = requirable ? { required: this.required } : {};

    // dropdownable is mutually exclusive with repeatable
    if (dropdownable) {
      switchnames.push("dropdown");
      switches.dropdown = this.values.ui == "dropdown";
    } else {
      // only if it is NOT dropdownable
      switchnames.push("repeatable");
      switches.repeatable = this.repeatable;
    }
    this.form_field.add_switches(this.id, switchnames, switches);

    // define the behavior of the 'required' switch
    if (requirable) {
      let req_input = this.form_field.form.querySelector(
        `#${this.id}-required`
      );

      // if it's a simple field with a checkbox
      if (this.type == "checkbox") {
        req_input.setAttribute("disabled", "");
      }
      req_input.addEventListener("change", () => {
        this.required = !this.required;
        this.required
          ? req_input.setAttribute("checked", "")
          : req_input.removeAttribute("checked");
      });
    }

    // define the behavior of the 'dropdown' switch
    if (dropdownable) {
      let dd_input = this.form_field.form.querySelector(`#${this.id}-dropdown`);
      dd_input.addEventListener("change", () => {
        this.values.ui =
          this.values.ui == "dropdown" ? this.dropdown_alt : "dropdown";
        this.values.ui == "dropdown"
          ? dd_input.setAttribute("checked", "")
          : dd_input.removeAttribute("checked");
      });
    } else {
      // define the behavior of the 'repeatable' switch
      let rep_input = this.form_field.form.querySelector(
        `#${this.id}-repeatable`
      );
      if (this.type == "checkbox") {
        rep_input.setAttribute("disabled", "");
      }
      rep_input.addEventListener("change", () => {
        this.repeatable = !this.repeatable;
        this.repeatable
          ? rep_input.setAttribute("checked", "")
          : rep_input.removeAttribute("checked");
      });
    }

    // add a button to confirm the changes
    this.form_field.add_action_button(
      this.mode == "add"
        ? `Add to ${
            this.schema_status.startsWith("object") ? "object" : "schema"
          }`
        : "Update",
      "add"
    );
  }

  /**
   * Create a modal to host the form to edit the field and define what happens when the form is "submitted".
   * @param {Schema} schema (Mini-)schema that the field is attached to.
   */
  create_modal(schema) {
    // define the ID of the editing modal
    let modal_id = `${this.mode}-${this.id}-${this.schema_name}-${this.schema_status}`;

    // create the modal
    let edit_modal = new Modal(modal_id, `Add ${this.button_title}`);

    // retrieve the form and add it to the modal
    let form = this.form_field.form;
    edit_modal.create_modal([form], "lg");

    // capture modal for manipulation
    let modal_dom = document.getElementById(modal_id);
    this.modal = bootstrap.Modal.getOrCreateInstance(modal_dom);
    if (schema.constructor.name == "ObjectEditor") {
      modal_dom.addEventListener("hidden.bs.modal", () => {
        bootstrap.Modal.getOrCreateInstance(
          document.getElementById(schema.card_id)
        ).show();
      });
    }

    // define behavior on form submission
    this.form_field.add_submit_action(
      "add",
      (e) => {
        e.preventDefault();
        // BS5 validation check
        if (!form.checkValidity()) {
          e.stopPropagation();
          form.classList.add("was-validated");
        } else {
          // create a new field of the same type with the data in the form
          let clone = this.register_fields(schema);

          // ok the form
          form.classList.remove("was-validated");

          // close the modal
          this.modal.toggle();

          // recreate the updated (probably cleaned) form
          modal_dom.querySelector(".modal-body").appendChild(form);

          // create id for the new field
          let clone_modal_id = `${clone.mode}-${clone.id}-${clone.schema_name}-${clone.schema_status}`;

          // if the new field is completely new or has changed ID
          if (clone_modal_id != modal_id) {
            // fill the new field's modal with its form
            let clone_modal_dom = document.getElementById(clone_modal_id);
            let clone_form = clone.form_field.form;
            clone_modal_dom
              .querySelector(".modal-body")
              .appendChild(clone_form);
          }
        }
      },
      false
    );

    // the lines below are a hack to avoid a new empty form from showing up as validated
    modal_dom.addEventListener("shown.bs.modal", (e) => {
      if (this.mode == "add") {
        form.classList.remove("was-validated");
      }
    });
  }

  delete_modal() {
    let modal_id = `${this.mode}-${this.id}-${this.schema_name}-${this.schema_status}`;
    let modal = document.getElementById(modal_id);
    if (modal != null) {
      modal.remove();
    }
  }

  /**
   * Prepare and make a new instance of a field available when editing a schema.
   * @param {Schema} schema (Mini-)schema the field belongs to.
   * @returns {HTMLDivElement} Element that contains an illustration example and a button to activate an editor modal.
   */
  render(schema) {
    this.id = `${this.form_type}-${schema.initial_name}`;

    // create the form to design the field and the modal that will host it
    this.create_form();
    this.create_modal(schema);

    // create the button that triggers the modal
    let modal_id = `add-${this.id}-${this.schema_name}-${schema.data_status}`;
    let new_button = Field.quick(
      "button",
      "btn btn-primary choice-button",
      this.button_title
    );
    new_button.setAttribute("data-bs-toggle", "modal");
    new_button.setAttribute("data-bs-target", "#" + modal_id);

    // append everything to a div
    let new_form = InputField.example_box(new_button);
    new_form.appendChild(this.create_example());

    return new_form;
  }

  /**
   * Create a box for the options to create new fields.
   *
   * @param {HTMLElement} button Content for the box.
   * @returns {HTMLDivElement} Element containing a button to activate a modal or example.
   */
  static example_box(button) {
    // append everything to a div
    let new_form = Field.quick("div", "shadow border rounded p-4 mb-3");
    new_form.appendChild(button);

    return new_form;
  }

  /**
   * Create or update an input field and update the Schema it belongs to.
   * Read the data from the editing form of the field and either update the field or create a new one.
   * In the latter case, reset the original form so it can be used for new instances of the field.
   * @param {Schema} schema (Mini-)schema the field belongs to.
   * @returns {InputField} Updated version of the input field.
   */
  register_fields(schema) {
    // retrieve data from the form
    let data = new FormData(this.form_field.form);
    let old_id = this.id;
    let new_id = data.get(`${this.id}-id`).trim();
    // capture the 'default' value if relevant
    if (this.required) {
      let default_value = data.get(`${this.id}-default`);
      if (default_value) {
        this.default = default_value.trim();
      }
    }
    if (this.help_is_custom) {
      let help = data.get(`${this.id}-help`);
      if (help) {
        this.help = help.trim();
      }
    }

    // if we are updating an existing field without changing the ID
    if (old_id == new_id) {
      this.title = data.get(`${this.id}-label`).trim();
      this.recover_fields(this.id, data); // update the field
      schema.update_field(this); // update the schema
      return this;
    } else {
      // if we are changing IDs or creating a new field altogether
      // create a new field with the same type

      let clone = this.clone(
        schema,
        new_id,
        data.get(`${this.id}-label`).trim()
      );
      clone.recover_fields(this.id, data);

      if (this.constructor.name == "ObjectInput") {
        // this will have to change to adapt to creating filled-schemas (attached to new ids)
        // clone.editor = this.editor;
        clone.create_editor();
        clone.editor.field_ids = [...this.editor.field_ids];
        this.editor.field_ids.forEach((fid) => {
          let field = this.editor.fields[fid];
          let new_field = field.clone(clone.editor, field.id, field.title);
          new_field.create_modal(this.editor);
          clone.editor.fields[fid] = new_field;
          field.delete_modal();
        });
        this.editor.reset();
      }

      // bring the current form, editor and contents to their original values
      this.reset();

      // set the mode of the new field, create form and modal that hosts the form
      clone.create_form();
      clone.create_modal(schema);

      // register new field in the schema
      if (this.mode == "mod") {
        schema.replace_field(old_id, clone);
      } else {
        schema.add_field(clone);
      }
      return clone;
    }
  }

  /**
   *
   * @param {Schema} schema (Mini-)schema that the field belongs to.
   * @param {String} new_id ID for the clone.
   * @param {String} title User-facing label of the clone, retrieved from the form
   * @returns {InputField} A new field with data from the form, to be added to the schema.
   */
  clone(schema, new_id, title) {
    let clone = new this.constructor(schema.initial_name, this.schema_status);
    // id as it will show in the "ID" field of the form
    clone.field_id = new_id;
    clone.id = new_id;

    // transfer the form
    clone.form_field = this.form_field;

    // register the main info
    clone.title = title;
    clone.required = this.required;
    clone.repeatable = this.repeatable;
    clone.default = this.default;
    clone.help = this.help;
    clone.help_is_custom = this.help_is_custom;
    clone.values = { ...this.values };
    clone.mode = "mod";
    return clone;
  }

  /**
   * Read the form used to edit the field and register the appropriate values.
   * Implemented within each subclass, except for `ObjectInput`.
   * @param {FormData} data Contents of the editing form of the field.
   */
  recover_fields(id, data) {
    return;
  }

  /**
   * Create an Element to show and edit the field.
   * @param {Schema} schema (Mini-)schema the field belongs to.
   * @returns {MovingViewer} Element to show and edit the field.
   */
  view(schema) {
    return new MovingViewer(this, schema);
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    this.required = false;
    this.repeatable = false;
    this.default = undefined;
    this.help_is_custom = false;
    this.form_field.reset();
    this.update_help();
  }

  /**
   * Select and instantiate the right class depending on the value of the JSON-originated date.
   * @static
   * @param {String} schema_name Name of the schema the field is attached to, for DOM ID purposes.
   * @param {String} data_status Status of the schema version the field is attached to, for DOM ID purposes.
   * @param {String} id ID of the field to create.
   * @param {FieldInfo} data Contents of the field to create.
   * @returns {InputField} The right input field with the data from the FieldInfo object.
   */
  static choose_class(schema_name, data_status, [id, data] = []) {
    let new_field;

    // if the type is 'object', create a composite field
    if (data.type == "object") {
      new_field = new ObjectInput(schema_name, data_status);
    } else if (data.type == "select") {
      // if the type is 'select', create a multiple-value or single-value multiple choice, depending on the value of 'multiple'
      new_field = data.multiple
        ? new CheckboxInput(schema_name, data_status)
        : new SelectInput(schema_name, data_status);
    } else {
      // the other remaining option is the single field
      new_field = new TypedInput(schema_name, data_status);
    }
    // fill in the basic information not present in the FieldInfo object
    new_field.field_id = id;
    new_field.id = id;
    new_field.mode = "mod";

    // read the FieldInfo object to retrieve and register the data
    new_field.from_json(data);
    return new_field;
  }

  /**
   * Check if the JSON is written in the correct way for a field.
   * @param {Object} json_object Value from a JSON uploaded as field data.
   * @returns {{'json_object':Object,'messages':String[],'ok':Boolean}} The json object (corrected if necessary), warnings/errors and whether it is ok.
   */
  static validate_class(json_object) {
    let messages = [];

    if (json_object.constructor.name != "Object") {
      messages.push("The field should be represented by an object!");
    } else if ("title" in json_object && "type" in json_object) {
      if (json_object.type == "object") {
        // if it's a composite field
        return ObjectInput.validate_class(json_object);
      } else if (json_object.type == "select") {
        // if it's a multiple-value field
        return MultipleInput.validate_class(json_object);
      } else if (TypedInput.text_options.indexOf(json_object.type) > -1) {
        // if it's a simple field
        return TypedInput.validate_class(json_object);
      } else {
        messages.push("The 'type' field is not valid!");
      }
    } else {
      if (!("title" in json_object)) {
        messages.push("The 'title' field is missing!");
      }
      if (!("type" in json_object)) {
        messages.push("The 'type' field is missing!");
      }
    }
    return {
      messages: messages,
      ok: false,
    };
  }
}

/**
 * Class representing a simple field.
 * Its `form_type` is always "text", whereas its `type` refers to one of many possible input options.
 * Its `button_title` is "Simple field" and its `description` includes the many input options.
 * @extends InputField
 * @property {Number} values.minimum For numeric inputs, the minimum possible value.
 * @property {Number} values.minimum For numeric inputs, the maximum possible value.
 * @property {String[]} text_options Possible type inputs.
 */
class TypedInput extends InputField {
  /**
   * Initialize a new single field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    super(schema_name, data_status);
    this.type = "text";
    this.values = { placeholder: "", pattern: "" };
    this.temp_values = {
      type: "text",
      min: null,
      max: null,
    };
  }

  form_type = "text"; // name of the class for DOM IDs
  button_title = "Simple field"; // user-facing name
  description =
    "Text options: regular text, number (integer or float), date, time, datetime, e-mail, URL or single checkbox.<br>";
  static text_options = [
    "text",
    "textarea",
    "email",
    "url",
    "date",
    "time",
    "datetime-local",
    "integer",
    "float",
    "checkbox",
  ];
  static types_with_placeholder = [
    "text",
    "textarea",
    "email",
    "url",
    "integer",
    "float",
  ];
  static types_with_regex = ["text", "email", "url"];

  /**
   * Depending on the existence of minimum or maximum for the numeric fields,
   * provide the appropriate descriptive text.
   * @returns {String} Text describing the range of a numeric field.
   */
  print_range() {
    let min =
      this.temp_values.min == null ? this.values.minimum : this.temp_values.min;
    let max =
      this.temp_values.max == null ? this.values.maximum : this.temp_values.max;
    // if we have both values
    if (min && max) {
      return `between ${min} and ${max}`;
    } else if (min) {
      // if we have the minimum only
      return `larger than ${min}`;
    } else if (max) {
      // if we have the maximum only
      return `smaller than ${max}`;
    } else {
      // if we don't have any
      return "";
    }
  }

  /**
   * Handle the input fields and values dependent on specific types of simple fields.
   * If a field editor is generated for the first time, include the appropriate fields.
   * If a different type is chosen while editing the field, add/remove the appropriate fields.
   */
  manage_format() {
    // Have a minimum or maximum values been defined?
    let has_range =
      this.values.minimum != undefined || this.values.maximum != undefined;

    // ID of the input fields for minimum and maximum (for numbers)
    let min_id = `${this.id}-min`;
    let max_id = `${this.id}-max`;

    // DIV and input fields for the placeholder (not always present)
    let placeholder_div = this.form_field.form.querySelector(
      `#div-${this.id}-placeholder`
    );

    // DIV and input fields for the regex pattern (not always present)
    let regex_div = this.form_field.form.querySelector(`#div-${this.id}-regex`);

    // DIV and input fields for the default value (not always present)
    let default_div = this.form_field.form.querySelector(
      `#div-${this.id}-default`
    );

    // add or remove placeholder
    if (TypedInput.types_with_placeholder.indexOf(this.temp_values.type) > -1) {
      this.add_placeholder_field();
    } else {
      if (placeholder_div != null) {
        this.form_field.form.removeChild(placeholder_div);
      }
    }

    // add or remove regex pattern
    if (TypedInput.types_with_regex.indexOf(this.temp_values.type) > -1) {
      this.add_regex_field();
    } else {
      if (regex_div != null) {
        this.form_field.form.removeChild(regex_div);
      }
    }

    // add or remove default based on type
    if (
      this.temp_values.type == "textarea" ||
      this.temp_values.type == "checkbox"
    ) {
      if (default_div != null) {
        this.form_field.form.removeChild(default_div);
      }
      this.default = undefined;
      if (this.temp_values.type == "checkbox") {
        this.required = false;
        this.repeatable = false;
      }
    } else {
      this.add_default_field();
    }

    let placeholder_input = this.form_field.form.querySelector(
      `#${this.id}-placeholder`
    );
    let default_input = this.form_field.form.querySelector(
      `#${this.id}-default`
    );

    // disable or enable switches based on type (if they have already been created)
    let switches_div = this.form_field.form.querySelector("div#switches-div");
    if (switches_div != undefined) {
      let switches = switches_div.querySelectorAll('input[role="switch"]');
      if (this.temp_values.type == "checkbox") {
        switches.forEach((sw) => {
          sw.setAttribute("disabled", "");
        });
      } else {
        switches.forEach((sw) => sw.removeAttribute("disabled"));
      }
    }

    // add or remove range inputs based on type
    if (
      (this.temp_values.type == "integer") |
      (this.temp_values.type == "float")
    ) {
      // adapt the type of the placeholder input field
      if (placeholder_input !== null) {
        placeholder_input.type = "number";
      }
      // adapt the type of the default input field
      if (default_input !== null) {
        default_input.type = "number";
      }

      // if there is no field for minimum and maximum yet
      // (because the numeric type has just been selected via the dropdown)
      if (this.form_field.form.querySelector("#" + min_id) == undefined) {
        // add input field for the minimum value
        this.form_field.add_input("Minimum", min_id, {
          placeholder: "0",
          value: has_range ? this.values.minimum : false, // value if it exists
          validation_message:
            "This field is compulsory and the value must be lower than the maximum.",
          required: false,
        });

        this.form_field.add_input("Maximum", max_id, {
          placeholder: "100",
          value: has_range ? this.values.maximum : false, // value if it exists
          validation_message:
            "This field is compulsory and the value must be higher than the minimum.",
          required: false,
        });
      }
      // assign the right type to the input fields for minimum and maximum
      let min_button = this.form_field.form.querySelector("#" + min_id);
      min_button.type = "number";
      let max_button = this.form_field.form.querySelector("#" + max_id);
      max_button.type = "number";

      // allow decimals for float input
      if (this.temp_values.type == "float") {
        min_button.setAttribute("step", "any");
        max_button.setAttribute("step", "any");
        if (placeholder_input !== null) {
          placeholder_input.setAttribute("step", "any");
        }
        if (default_input !== null) {
          default_input.setAttribute("step", "any");
        }
      }

      // adapt minima of maximum and default fields when a new minimum is provided
      min_button.addEventListener("change", () => {
        max_button.min = min_button.value;
        if (placeholder_input != null) {
          placeholder_input.min = min_button.value;
        }
        if (default_input != null) {
          default_input.min = min_button.value;
        }
        this.temp_values.min = min_button.value;
        this.update_help();
      });

      // adapt maxima of minimum and default fields when a new maximum is provided
      max_button.addEventListener("change", () => {
        min_button.max = max_button.value;
        if (placeholder_input != null) {
          placeholder_input.max = max_button.value;
        }
        if (default_input != null) {
          default_input.max = max_button.value;
        }
        this.temp_values.max = max_button.value;
        this.update_help();
      });
    } else {
      // if the field is not numeric (anymore)
      // remove the min and max input fields

      if (
        this.form_field.form.querySelectorAll('.form-container [type="number"]')
          .length > 0
      ) {
        this.form_field.form.removeChild(
          document.getElementById(`div-${min_id}`)
        );
        this.form_field.form.removeChild(
          document.getElementById(`div-${max_id}`)
        );
      }

      // if minimum and maximum values had been provided
      if (has_range) {
        delete this.values.minimum;
        delete this.values.maximum;
      }
      // adapt the type of the default input
      if (placeholder_input !== null) {
        placeholder_input.type =
          this.temp_values.type == "textarea" ? "text" : this.temp_values.type;
      }

      // adapt the type of the default input
      if (default_input !== null) {
        default_input.type = this.temp_values.type;
      }
    }

    // adapt the description of the default input field based on the type
    if (placeholder_input !== null) {
      let num_validator =
        placeholder_input.input == "number" ? this.print_range() : "";
      let validator = `This field must be of type ${this.temp_values.type}${num_validator}.`;
      placeholder_input.parentElement.querySelector(
        ".invalid-feedback"
      ).innerHTML = validator;
    }

    // adapt the description of the default input field based on the type
    if (default_input !== null) {
      let num_validator =
        default_input.input == "number" ? this.print_range() : "";
      let validator = `This field must be of type ${this.temp_values.type}${num_validator}.`;
      default_input.parentElement.querySelector(".invalid-feedback").innerHTML =
        validator;
    }
    this.update_help();
  }

  /**
   * Parse an object to fill in the properties of the object instance.
   * Next to the parent class workflow, define the subtitle and retrieve the minimum and maximum for numeric inputs.
   * @param {FieldInfo} data JSON representation of the contents of the field.
   */
  from_json(data) {
    super.from_json(data);
    if ((this.type == "integer") | (this.type == "float")) {
      this.values = { minimum: data.minimum, maximum: data.maximum };
      this.temp_values = { ...this.values };
    }
    this.temp_values.type = this.type;
    if ("placeholder" in data) {
      this.values.placeholder = data.placeholder;
    }
    if ("pattern" in data) {
      this.values.pattern = data.pattern;
    }
    this.update_help();
  }

  update_help() {
    if (!this.help_is_custom) {
      let par_text =
        (this.temp_values.type == "integer") |
        (this.temp_values.type == "float")
          ? `${this.temp_values.type} ${this.print_range()}`
          : this.temp_values.type;
      this.help = `Input type: ${par_text}`;
      if (this.form_field) {
        let help_field = this.form_field.form.querySelector(`#${this.id}-help`);
        if (help_field != undefined) {
          help_field.value = this.help;
        }
      }
    }
  }

  /**
   * Create an example of a Simple Field.
   * @static
   * @returns {HTMLInputElement} The field to add in an illustration example.
   */
  static ex_input() {
    let inner_input = Field.quick("input", "form-control");
    inner_input.value = "Some text";
    inner_input.setAttribute("readonly", "");
    return inner_input;
  }

  /**
   * If relevant, create and add an input field for the placeholder value.
   */
  add_placeholder_field() {
    // if the field does not exist yet (it may have been removed for textarea and checkbox)
    if (
      this.form_field.form.querySelector(`#div-${this.id}-placeholder`) ==
      undefined
    ) {
      this.form_field.add_input("Placeholder", `${this.id}-placeholder`, {
        description: "Example of a value for this field.",
        value: this.values.placeholder,
        required: false,
      });
      let placeholder_div = this.form_field.form.querySelector(
        `div#div-${this.id}-placeholder`
      );
      let divider = this.form_field.form.querySelector(`hr#${this.id}-divider`);
      if (divider.nextSibling != placeholder_div) {
        this.form_field.form.insertBefore(placeholder_div, divider.nextSibling);
      }
    }
  }

  /**
   * If relevant, create and add an input field for the regex pattern.
   */
  add_regex_field() {
    // if the field does not exist yet (it may have been removed for textarea and checkbox)
    if (
      this.form_field.form.querySelector(`#div-${this.id}-regex`) == undefined
    ) {
      this.form_field.add_input("Regex pattern", `${this.id}-regex`, {
        description: "A regular expression to use in validation.",
        value: this.values.pattern,
        required: false,
      });
      let regex_div = this.form_field.form.querySelector(
        `div#div-${this.id}-regex`
      );
      let placeholder_div = this.form_field.form.querySelector(
        `div#div-${this.id}-placeholder`
      );
      if (placeholder_div.nextSibling != regex_div) {
        this.form_field.form.insertBefore(
          regex_div,
          placeholder_div.nextSibling
        );
      }
    }
  }

  /**
   * If relevant, create and add an input field for the default value.
   */
  add_default_field() {
    // if the field does not exist yet (it may have been removed for textarea and checkbox)
    if (
      this.form_field.form.querySelector(`#div-${this.id}-default`) == undefined
    ) {
      this.form_field.add_input("Default value", `${this.id}-default`, {
        description:
          "Default value for this field: only valid if the field is required.",
        value: this.default,
        required: false,
      });
    }
  }

  /**
   * Create an element with an input field, either to view in a schema-view or to fill in annotation.
   * The restrictions of the field are described in a subtitle on top of the input field in the schema-view
   * and as a description under the input field in the annotation form.
   * In schema-view, the field is read-only, but the default value is filled in if appropriate.
   * @param {Boolean} active Whether the form is meant to be used in annotation.
   * @returns {HTMLDivElement}
   */
  viewer_input(active = false) {
    let div = document.createElement("div");

    // set up input field description as subtitle or as input-description
    let subtitle = Field.quick("div", "form-text mt-0 mb-1", this.help);
    subtitle.id = "help-" + this.id;

    // define input shape
    let input;
    if (this.type == "textarea") {
      input = Field.quick("textarea", "form-control input-view");
      if (this.values.placeholder) {
        input.placeholder = this.values.placeholder;
      }
    } else if (this.type == "checkbox") {
      // single checkbox with no text and only "true" as possible value
      input = Field.quick("div", "form-check");
      let input_input = Field.quick("input", "form-check-input");
      input_input.type = "checkbox";
      input_input.value = true;
      input_input.id = "check-" + this.id;
      let input_label = Field.quick(
        "label",
        "form-check-label visually-hidden",
        "Check if true."
      );
      input_label.setAttribute("for", "check-" + this.id);
      input.appendChild(input_input);
      input.appendChild(input_label);
    } else {
      // input with the right type (for validation and other features)
      input = Field.quick("input", "form-control input-view");
      input.type =
        (this.type == "float") | (this.type == "integer")
          ? "number"
          : this.type;
      if (this.type == "float") {
        input.setAttribute("step", "any");
      }
      input.setAttribute("aria-describedby", subtitle.id);
      // only these types can be required and have a default value
      if (this.required && this.default !== undefined) {
        input.value = this.default;
      }
      if (this.values.placeholder) {
        input.placeholder = this.values.placeholder;
      }
      if (this.values.pattern) {
        input.pattern = this.values.pattern;
      }
    }
    div.appendChild(subtitle);
    div.appendChild(input);

    // define value
    if (!active) {
      // in the manager
      if (this.type == "checkbox") {
        input.querySelector("input").setAttribute("readonly", "");
      } else {
        input.setAttribute("readonly", "");
      }
    } else {
      // when implementing form
      let value = Field.include_value(this);

      if (this.type == "checkbox") {
        input.querySelector("input").name = this.name;
        if (value) {
          input.querySelector("input").setAttribute("checked", "");
        }
      } else {
        input.name = this.name;
        if (this.required) {
          input.setAttribute("required", "");
        }
        if (value != undefined) {
          input.value = value;
        }
        if (this.values.minimum != undefined) {
          input.min = this.values.minimum;
        }
        if (this.values.maximum != undefined) {
          input.max = this.values.maximum;
        }
      }
    }
    return div;
  }

  /**
   * Create a form to edit the field.
   * Between setup and ending, add the dropdown to select the type and any other appropriate field.
   */
  create_form() {
    // initiate the form
    this.setup_form();

    // add the dropdown for the possible options
    this.form_field.add_select(
      "Input type",
      `${this.id}-format`,
      TypedInput.text_options,
      this.type
    );

    // when selecting from the dropdown, adapt the contents of the form
    this.form_field.form
      .querySelector(".form-select")
      .addEventListener("change", () => {
        this.temp_values.type =
          this.form_field.form.elements[`${this.id}-format`].value;
        this.manage_format();
      });

    let divider = document.createElement("hr");
    divider.id = this.id + "-divider";
    let last_element = this.form_field.switches
      ? this.form_field.switches
      : this.form_field.divider;
    this.form_field.form.insertBefore(divider, last_element);

    // add any other relevant input field
    this.manage_format();

    // finish form
    this.end_form();
  }

  /**
   *
   * @param {Schema} schema (Mini-)schema that the field belongs to.
   * @param {String} new_id ID for the clone.
   * @param {String} title User-facing label of the clone, retrieved from the form
   * @returns {InputField} A new field with data from the form, to be added to the schema.
   */
  clone(schema, new_id, title) {
    let clone = super.clone(schema, new_id, title);
    clone.temp_values = { ...this.temp_values };
    return clone;
  }

  /**
   * Read the form used to edit the field and register the values (on submission).
   * @param {FormData} data Contents of the editing form of the field.
   */
  recover_fields(id, data) {
    // capture type
    this.type = data.get(`${id}-format`).trim();

    // capture minimum and maximum values if relevant
    if ((this.type === "integer") | (this.type == "float")) {
      let minimum = data.get(`${id}-min`);
      let maximum = data.get(`${id}-max`);
      if (minimum) this.values.minimum = minimum.trim();
      if (maximum) this.values.maximum = maximum.trim();
    }

    if (TypedInput.types_with_placeholder.indexOf(this.type) > -1) {
      let placeholder = data.get(`${id}-placeholder`);
      if (placeholder) this.values.placeholder = placeholder.trim();
    } else {
      this.values.placeholder = "";
    }
    if (TypedInput.types_with_regex.indexOf(this.type) > -1) {
      let pattern = data.get(`${id}-regex`);
      if (pattern) this.values.pattern = pattern.trim();
    } else {
      this.values.pattern = "";
    }
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    let form = this.form_field.form;
    // remove the min and max fields if they exist
    if (form.querySelector(`#div-${this.id}-min`) != undefined) {
      form.removeChild(document.getElementById(`div-${this.id}-min`));
      form.removeChild(document.getElementById(`div-${this.id}-max`));
    }
    if (form.querySelector(`#div-${this.id}-placeholder`) != undefined) {
      form.querySelector(`#${this.id}-placeholder`).type = "text";
    }
    if (form.querySelector(`#div-${this.id}-default`) != undefined) {
      form.querySelector(`#${this.id}-default`).type = "text";
    }
    this.values = { placeholder: "", pattern: "" };
    this.temp_values = {
      type: "text",
      min: null,
      max: null,
    };
    super.reset();
  }

  /**
   * Check if the JSON is written in the correct way for a simple field.
   * @param {Object} json_object Value from a JSON uploaded as field data.
   * @returns {{'json_object':Object,'messages':String[],'ok':Boolean}} The json object (corrected if necessary), warnings/errors and whether it is ok.
   */
  static validate_class(json_object) {
    let messages = [];

    // check required attribute
    if ("required" in json_object) {
      if (json_object.type == "checkbox") {
        delete json_object.required;
        messages.push("A simple field of type 'checkbox' cannot be required.");
      } else if (json_object.required.constructor.name != "Boolean") {
        if (json_object.required.toLowerCase() == "true") {
          json_object.required = true;
          messages.push(
            "The 'required' attribute was a string, but we turned it to boolean."
          );
        } else {
          delete json_object.required;
          messages.push(
            "The 'required' attribute was not boolean: it was deleted."
          );
        }
      }
    }

    // check default attribute (if it's appropriate)
    if ("default" in json_object) {
      if (!("required" in json_object && json_object.required)) {
        delete json_object.default;
        messages.push(
          "There is no 'required' attribute or it is false so the 'default' attribute was deleted."
        );
      }
      if (json_object.type == "textarea") {
        delete json_object.default;
        messages.push(
          "A field of type 'textarea' cannot have a default value; it was deleted."
        );
      }
    }

    // check maximum and minimum as well as numeric type of default
    for (let attr of ["minimum", "maximum", "default"]) {
      if (attr in json_object) {
        if (json_object.type == "integer" || json_object.type == "float") {
          let val =
            json_object.type == "integer"
              ? parseInt(json_object[attr])
              : parseFloat(json_object[attr]);
          if (isNaN(val)) {
            delete json_object[attr];
            messages.push(
              `The ${attr} should be an ${json_object.type}: it was deleted.`
            );
          }
        } else if (attr != "default") {
          delete json_object[attr];
          messages.push(
            `Simple fields of type ${json_object.type} cannot have an attribute ${attr}: it was deleted.`
          );
        }
      }
    }

    // check repeatable attribute
    if ("repeatable" in json_object) {
      if (json_object.type == "checkbox") {
        delete json_object.repeatable;
        messages.push("A simple field of type 'checkbox' cannot be repeated.");
      } else if (json_object.repeatable.constructor.name != "Boolean") {
        if (json_object.repeatable.toLowerCase() == "true") {
          json_object.repeatable = true;
          messages.push(
            "The 'repeatable' attribute was a string, but we turned it to boolean."
          );
        } else {
          delete json_object.repeatable;
          messages.push(
            "The 'repeatable' attribute was not boolean: it was deleted."
          );
        }
      }
    }

    // check placeholder attribute
    if (
      "placeholder" in json_object &&
      TypedInput.types_with_placeholder.indexOf(json_object.type) == -1
    ) {
      delete json_object.placeholder;
      messages.push(
        `The 'placeholder' attribute is not compatible with a field of type ${json_object.type}: it was deleted.`
      );
    }

    // check pattern attribute
    if (
      "pattern" in json_object &&
      TypedInput.types_with_regex.indexOf(json_object.type) == -1
    ) {
      delete json_object.pattern;
      messages.push(
        `The 'pattern' attribute is not compatible with a field of type ${json_object.type}: it was deleted.`
      );
    }

    let acceptable_fields = [
      "type",
      "title",
      "required",
      "default",
      "minimum",
      "maximum",
      "repeatable",
      "help",
      "placeholder",
      "pattern",
    ];
    for (let attr of Object.keys(json_object)) {
      if (acceptable_fields.indexOf(attr) == -1) {
        delete json_object[attr];
        messages.push(
          `The attribute '${attr}' was deleted because it is not appropriate for a simple field.`
        );
      }
    }

    return {
      json_object: json_object,
      messages: messages,
      ok: true,
    };
  }
}

/**
 * Class representing a composite field
 * Its `form_type` is always "object", like its `type`.
 * Its `button_title` is "Composite field" and its description is a brief summary.
 * @extends InputField
 * @property {ObjectEditor} editor Mini-schema containing the InputFields corresponding to the components of the composite field
 * @property {FieldInfo} json_source Contents coming from a JSON file, used to fill in the `editor`.
 */
class ObjectInput extends InputField {
  /**
   * Initialize a new Field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    super(schema_name, data_status);
  }

  form_type = "object";
  button_title = "Composite field";
  description =
    "This can contain any combination of the previous form elements.<br>";

  /**
   * Create and link a mini-schema (ObjectEditor) to contain the subfields.
   */
  create_editor() {
    // If it doesn't exist, create a new ObjectEditor, otherwise just update the id of the form
    if (this.editor == undefined) {
      this.editor = new ObjectEditor(this);
    } else {
      this.editor.form_id = this.form_field.form.id;
    }
    // Start up the editor (offering subfield options)
    this.editor.display_options();
  }

  /**
   * Turn the relevant fields into an Object to be saved in a JSON file, based on the contents of `editor`.
   * Overrides the parent version.
   * @returns {FieldInfo} JSON representation of the contents of the field.
   */
  to_json() {
    // Update `this.editor.properties` with the Object version of its subfields
    this.editor.fields_to_json();
    // create the object
    let json = {
      title: this.title,
      properties: this.editor.properties,
      type: "object",
    };

    if (this.required) json.required = this.required;
    if (this.repeatable) json.repeatable = this.repeatable;
    if (this.help) json.help = this.help;

    return json;
  }

  /**
   * Parse an object to fill in the properties of the object instance.
   * @param {FieldInfo} data JSON representation of the contents of the field.
   */
  from_json(data) {
    // register the contents
    super.from_json(data);

    // copy the data to the `json_source` property so the `editor` can access it
    this.json_source = data;
  }

  /**
   * Create an example of a Composite Field.
   * @static
   * @returns {HTMLInputElement} The field to add in an illustration example.
   */
  static ex_input() {
    // instantiate a mini-schema just for illustration
    let mini_object = new DummyObject();

    // render the example fields into a simulated viewer
    let inner_input = ComplexField.create_viewer(mini_object, true);
    inner_input
      .querySelectorAll("input")
      .forEach((input) => input.setAttribute("readonly", ""));
    inner_input.setAttribute("style", "display:block;");
    return inner_input;
  }

  /**
   * Create an element with a nested form, either to view in a schema-view or to fill in annotation.
   * The result is a box with the corresponding `viewer_input` outputs of the components.
   * @param {Boolean} active Whether the form is meant to be used in annotation.
   * @returns {HTMLDivElement}
   */
  viewer_input(active = false) {
    return ComplexField.create_viewer(this.editor, active);
  }

  /**
   * Create a form to edit the field.
   * Between setup and ending, create and link an ObjectEditor and fill it with existing data.
   */
  create_form() {
    // setup the form
    this.setup_form();

    // create and link an ObjectEditor (mini-schema)
    this.create_editor();

    // if there is existing data, fill in the editor
    if (this.json_source != undefined) {
      this.editor.from_json(this.json_source);
    }

    // finish the form
    this.end_form();

    // insert the 'add element' button before the switches
    const switches = this.form_field.form.querySelector("#switches-div");
    this.form_field.form.insertBefore(this.editor.button, switches);
  }

  /**
   * Create a modal to host the form to edit the field and define what happens when the form is "submitted".
   * @param {Schema} schema (Mini-)schema that the field is attached to.
   */
  create_modal(schema) {
    // Initiate the modal
    super.create_modal(schema);

    // Assign the id of the modal as the hook of the editor
    this.editor.card_id = `${this.mode}-${this.id}-${this.schema_name}-${this.schema_status}`;

    // Go through each subfield and render it
    this.editor.field_ids.forEach((field_id, idx) => {
      this.editor.new_field_idx = idx;
      this.editor.view_field(this.editor.fields[field_id]);
    });
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    // reset the form and field
    super.reset();
    this.form_field.form.querySelectorAll(".viewer").forEach((card) => {
      card.nextSibling.remove();
      card.remove();
    });
  }

  /**
   * Check if the JSON is written in the correct way for a composite field.
   * @param {Object} json_object Value from a JSON uploaded as field data.
   * @returns {{'json_object':Object,'messages':String[],'ok':Boolean}} The json object (corrected if necessary), warnings/errors and whether it is ok.
   */
  static validate_class(json_object) {
    let messages = [];

    if (!("properties" in json_object)) {
      json_object.properties = {};
      messages.push("An empty 'properties' field was created.");
    } else if (json_object.properties.constructor.name != "Object") {
      json_object.properties = {};
      messages.push(
        "The value of 'properties' was not appropriate so it was replaced with an empty field."
      );
    } else {
      for (let field of Object.entries(json_object.properties)) {
        const { json_object: new_json, ok: new_ok } = InputField.validate_class(
          field[1]
        );
        if (!new_ok) {
          delete json_object.properties[field[0]];
          messages.push(
            `The field '${field[0]}' was removed because its contents were not correct.`
          );
          // maybe do something with ITS messages?
        } else {
          json_object.properties[field[0]] = new_json;
        }
      }
    }
    // check repeatable attribute
    if (
      "repeatable" in json_object &&
      json_object.repeatable.constructor.name != "Boolean"
    ) {
      if (json_object.repeatable.toLowerCase() == "true") {
        json_object.repeatable = true;
        messages.push(
          "The 'repeatable' attribute was a string, but we turned it to boolean."
        );
      } else {
        delete json_object.repeatable;
        messages.push(
          "The 'repeatable' attribute was not boolean: it was deleted."
        );
      }
    }

    let acceptable_fields = [
      "type",
      "title",
      "properties",
      "repeatable",
      "help",
    ];
    for (let attr of Object.keys(json_object)) {
      if (acceptable_fields.indexOf(attr) == -1) {
        delete json_object[attr];
        messages.push(
          `The attribute '${attr}' was deleted because it is not appropriate for a composite field.`
        );
      }
    }

    return {
      json_object: json_object,
      messages: messages,
      ok: true,
    };
  }
}

/**
 * Class representing a multiple-choice field.
 * Its `form_type` depends on the subclass; its `type` is always "select".
 * Its `button_title` depends on the subclass.
 * @extends InputField
 * @property {Array<String|Number>} values.values Posible values to choose from.
 * @property {Boolean} values.multiple Whether multiple values can be selected.
 * @property {String} values.ui UI rendering of the field (dropdown, checkbox or radio).
 * @property {Boolean} repeatable Whether the field can be repeatable (it cannot).
 */
class MultipleInput extends InputField {
  /**
   * Initialize a new MultipleInput Field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    super(schema_name, data_status);
    this.type = "select";
    this.values.values = [];
  }

  repeatable = false;

  /**
   * Parse an object to fill in the properties of the object instance.
   * Next to the parent class workflow, retrieve the 'values', 'multiple' and 'ui' attributes.
   * @param {FieldInfo} data JSON representation of the contents of the field.
   */
  from_json(data) {
    // Retrieve the common attributes
    super.from_json(data);

    // Retrive multiple-choice specific attributes
    this.values = { values: data.values, multiple: data.multiple, ui: data.ui };
  }

  /**
   * Create an element with the right type of input field, either to view in a schema-view or to fill in annotation.
   * @param {Boolean} active Whether the form is meant to be used in annotation.
   * @returns {HTMLDivElement}
   */
  viewer_input(active = false) {
    let div = document.createElement("div");
    let form_shape =
      this.values.ui == "dropdown" // If UI is 'dropdown'
        ? Field.dropdown(this, active) // create a dropdown
        : Field.checkbox_radio(this, active); // otherwise a checkbox or radio
    if (this.help) {
      let subtitle = Field.quick("div", "form-text mt-0 mb-1", this.help);
      subtitle.id = "help-" + this.id;
      div.appendChild(subtitle);
      if (this.values.ui == "dropdown") {
        form_shape.setAttribute("aria-describedby", subtitle.id);
      } else {
        form_shape.querySelectorAll("div.form-check").forEach((subdiv) => {
          subdiv
            .querySelector(".form-check-input")
            .setAttribute("aria-describedby", subtitle.id);
        });
      }
    }
    div.appendChild(form_shape);

    return div;
  }

  /**
   * Create a form to edit the field.
   * Between setup and ending, add moving options depending on the existing values.
   */
  create_form() {
    // Setup form
    this.setup_form();

    // Add moving input fields to design the options
    this.form_field.add_moving_options("Select option", this.values.values);

    // Finish form
    this.end_form();
  }

  /**
   * Read the form used to edit the field and register the values (on submission).
   * @param {FormData} data Contents of the editing form of the field.
   */
  recover_fields(id, data) {
    // reset whatever values existing
    this.values.values = [];
    // go through values in the form
    for (let pair of data.entries()) {
      // add the value of moving input fields only
      if (pair[0].startsWith("mover")) {
        this.values.values.push(pair[1].trim());
      }
    }
    let default_field = this.form_field.form.querySelector(`#${id}-default`);
    if (default_field !== null) {
      let selected = default_field.querySelector("option[selected]");
      let selected_value = selected == null ? null : selected.value.trim();
      default_field.querySelectorAll("option").forEach((x) => x.remove());
      for (let i of this.values.values) {
        let new_option = document.createElement("option");
        new_option.value = i;
        new_option.innerHTML = i;
        if (selected_value != null && i == selected_value) {
          new_option.setAttribute("selected", "");
        }
        default_field.appendChild(new_option);
      }
    }
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    let form = this.form_field.form;
    // remove all moving fields except for two
    while (form.querySelectorAll(".blocked").length > 2) {
      MovingChoice.remove_div(form.querySelector(".blocked"));
    }

    // reset the form and field
    super.reset();
    this.values.values = [];
  }

  /**
   * Check if the JSON is written in the correct way for a multiple-choice field.
   * @param {Object} json_object Value from a JSON uploaded as field data.
   * @returns {{'json_object':Object,'messages':String[],'ok':Boolean}} The json object (corrected if necessary), warnings/errors and whether it is ok.
   */
  static validate_class(json_object) {
    let messages = [];
    let ok = true;

    // check multiple attribute
    if (!("multiple" in json_object)) {
      messages.push(
        "The 'multiple' attribute is missing and is compulsory for multiple-choice fields."
      );
      ok = false;
    } else if (json_object.multiple.constructor.name != "Boolean") {
      if (json_object.multiple.toLowerCase() == "true") {
        json_object.multiple = true;
        messages.push(
          "The 'multiple' attribute was a string, but we turned it to boolean."
        );
      } else if (json_object.multiple.toLowerCase() == "false") {
        json_object.multiple = false;
        messages.push(
          "The 'multiple' attribute was a string, but we turned it to boolean."
        );
      } else {
        messages.push("The 'multiple' attribute was not boolean.");
        ok = false;
      }
    }

    // check ui attribute
    if (!("ui" in json_object)) {
      messages.push(
        "The 'ui' attribute is missing and is compulsory for multiple-choice fields."
      );
      ok = false;
    } else if (
      json_object.multiple &&
      ["checkbox", "dropdown"].indexOf(json_object.ui) == -1
    ) {
      messages.push(
        "The 'ui' attribute for a multiple-value multiple-choice must be 'checkbox' or 'dropdown'."
      );
      ok = false;
    } else if (
      json_object.multiple === false &&
      ["radio", "dropdown"].indexOf(json_object.ui) == -1
    ) {
      messages.push(
        "The 'ui' attribute for a single-value multiple-choice must be 'radio' or 'dropdown'."
      );
      ok = false;
    }

    // check required attribute (only valid for multiple = false)
    if ("required" in json_object) {
      if (json_object.multiple) {
        delete json_object.required;
        messages.push(
          "The 'required' attribute is not appropriate for a multiple-value multiple-choice field so it was deleted."
        );
      } else if (json_object.required.constructor.name != "Boolean") {
        if (json_object.required.toLowerCase() == "true") {
          json_object.required = true;
          messages.push(
            "The 'required' attribute was a string, but we turned it to boolean."
          );
        } else {
          delete json_object.required;
          messages.push(
            "The 'required' attribute was not boolean: it was deleted."
          );
        }
      }
    }

    // check default attribute (if it's appropriate)
    if ("default" in json_object) {
      if (!("required" in json_object && json_object.required)) {
        delete json_object.default;
        messages.push(
          "There is no 'required' attribute or it is false so the 'default' attribute was deleted."
        );
      }
    }

    // check values
    if (
      !("values" in json_object) ||
      json_object.values.constructor.name != "Array" ||
      json_object.values.length < 2
    ) {
      messages.push(
        "The 'values' attribute should be an array with at least two values."
      );
      ok = false;
    }

    let acceptable_fields = [
      "type",
      "title",
      "required",
      "default",
      "ui",
      "multiple",
      "values",
      "help",
    ];
    for (let attr of Object.keys(json_object)) {
      if (acceptable_fields.indexOf(attr) == -1) {
        delete json_object[attr];
        messages.push(
          `The attribute '${attr}' was deleted because it is not appropriate for a multiple-choice field.`
        );
      }
    }

    return {
      json_object: json_object,
      messages: messages,
      ok: ok,
    };
  }
}

/**
 * Class representing a single-value multiple-choice field.
 * Its `form_type` is always "selection"; its `type` remains "select".
 * Its `button_type` is always "Single-value multiple choice".
 * Its `values.multiple` property is always "false"; its `values.ui` property can only be "dropdown" or "radio".
 * @extends MultipleInput
 * @property {String} dropdown_alt The alternative to dropdown: "radio".
 */
class SelectInput extends MultipleInput {
  /**
   * Initialize a new SelectInput Field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    super(schema_name, data_status);
    this.values.multiple = false;
    this.values.ui = "radio";
  }

  form_type = "selection";
  button_title = "Singe-value multiple choice";
  dropdown_alt = "radio";

  /**
   * If relevant, create and add a dropdown for the default value.
   * The dropdown options do not adapt as you edit the possible options because that's too much work.
   * But once you have saved your input, the next edit will offer the right options.
   */
  add_default_field() {
    this.form_field.add_select(
      "Default value (if field is required)",
      `${this.id}-default`,
      this.values.values,
      this.default
    );
  }

  /**
   * Create an example of a Single-value Multiple Choice field
   * @static
   * @returns {HTMLInputElement} The field to add in an illustration example.
   */
  static ex_input() {
    // create two columns, one to show a dropdown and one for radio buttons
    let columns = Field.quick("div", "row h-50");
    let col1 = Field.quick("div", "col-6 p-2 mb-2");
    let col2 = Field.quick("div", "col-6 p-2 mb-2");
    columns.appendChild(col1);
    columns.appendChild(col2);

    // create a dummy version for illustration with three default values
    let example_input = new SelectInput("example");
    example_input.values.values = ["one", "two", "three"];
    example_input.name = "select-example";

    // create the dropdown rendering of the illustrative example and append to left column
    let dropdown = Field.dropdown(example_input);
    dropdown.querySelector('option[value="one"]').setAttribute("selected", "");
    dropdown.setAttribute("readonly", "");
    col1.appendChild(dropdown);

    // create the radio rendering of the illustrative example and append to right column
    let radio = Field.checkbox_radio(example_input);
    radio.querySelector('input[value="one"]').setAttribute("checked", "");
    radio
      .querySelectorAll("input")
      .forEach((input) => input.setAttribute("readonly", ""));
    col2.appendChild(radio);

    return columns;
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    super.reset();
    this.values.ui = "radio";
  }
}

/**
 * Class representing a multiple-value multiple-choice field.
 * Its `form_type` is always "checkbox"; its `type` remains "select".
 * Its `button_type` is always "Multiple-value multiple choice".
 * Its `values.multiple` property is always "true"; its `values.ui` property can only be "dropdown" or "checkbox".
 * @extends MultipleInput
 * @property {String} dropdown_alt The alternative to dropdown: "checkbox".
 */
class CheckboxInput extends MultipleInput {
  /**
   * Initialize a new CheckboxInput Field in a (mini-)schema.
   * @class
   * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
   * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
   */
  constructor(schema_name, data_status = "draft") {
    super(schema_name, data_status);
    this.values.multiple = true;
    this.values.ui = "checkbox";
  }

  form_type = "checkbox";
  button_title = "Multiple-value multiple choice";
  dropdown_alt = "checkbox";

  /**
   * Create an example of a Multiple-value Multiple Choice field
   * @static
   * @returns {HTMLInputElement} The field to add in an illustration example.
   */
  static ex_input() {
    // create two columns, one to show a dropdown and one for checkboxes
    let columns = Field.quick("div", "row");
    let col1 = Field.quick("div", "col-6 p-2");
    let col2 = Field.quick("div", "col-6 p-2");
    columns.appendChild(col1);
    columns.appendChild(col2);

    // create a dummy version for illustration with three default values
    let example_input = new CheckboxInput("example");
    example_input.values.values = ["one", "two", "three"];
    example_input.name = "checkbox-example";

    // create the dropdown rendering of the illustrative example and append to left column
    let dropdown = Field.dropdown(example_input);
    dropdown.querySelectorAll("option").forEach((option) => {
      if (option.value == "one" || option.value == "two")
        option.setAttribute("selected", "");
    });
    dropdown.setAttribute("readonly", "");
    col1.appendChild(dropdown);

    // create the checkboxes rendering of the illustrative example and append to right column
    let checkboxes = Field.checkbox_radio(example_input);
    checkboxes.querySelectorAll("input").forEach((input) => {
      if (input.value != "three") input.setAttribute("checked", "");
      input.setAttribute("readonly", "");
    });
    col2.appendChild(checkboxes);

    return columns;
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    super.reset();
    this.values.ui = "checkbox";
  }
}
