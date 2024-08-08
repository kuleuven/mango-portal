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
 * @property {Schema} schema Schema the field belongs to.
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
   */
  constructor() {
    // Strings for the example
    this.description = "";
    this.dummy_title = "Informative label";

    this.id = InputField.validate_random_id(InputField.make_id());
    field_ids.push(this.id);

    // Attributes to limit some behavior
    this.mode = "add";
    // this.is_duplicate = false;

    // Info about the field contents
    this.required = false;
    this.repeatable = false;
    this.values = {};
    this.help = "";
    this.help_is_custom = false;
  }

  attach_schema(schema) {
    // Schema information
    this.schema = schema;
    this.id_regex = schema.field_id_regex;
  }

  static make_id() {
    return "f" + Math.random().toString(36).substring(2);
  }

  static validate_random_id(random_id) {
    while (field_ids.indexOf(random_id) > -1) {
      random_id = InputField.make_id();
    }
    return random_id;
  }


  get_form_div(key) {
    return this.form_field.form.querySelector(`#div-${this.get_domel_id(key)}`);
  }

  get_form_input(key) {
    return this.form_field.form.querySelector(`input#${this.get_domel_id(key)}`);
  }

  activate_autocomplete() {
    return null;
  }

  read_autocomplete() {
    return null;
  }

  autocomplete_selector() {
    return undefined;
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
    this.help = data.help;
  }

  /**
   * Add a new field to the (mini-)schema.
   */
  add_to_schema() {
    // Add the field ID to the list of field IDs, in the right order
    this.schema.fields.push(this);
    this.schema.update_field_id_regex();

    // Enable or disable 'saving' the schema based on whether this field has been created by duplicating.
    this.schema.add_wip(this.id);

    // Create the MovingViewer and add it to the editing section of the schema
    this.view_field();
  }

  get position() {
    return this.schema.fields.indexOf(this);
  }

  /**
   * Update an existing field in a schema.
   */
  update_field() {
    // Replace the field in this.fields
    this.schema.fields[this.position] = this;
    this.schema.add_wip(this.id);
    this.schema.autosave();
    this.schema.toggle_saving();

    // Identify the form with MovingViewers and the MovingViewer itself
    const viewer = this.schema.field_box.querySelector(
      "#" + this.get_domel_id("viewer")
    );

    // Update the title of the MovingViewer
    viewer.querySelector("h5").innerHTML = this.required
      ? this.title + "*"
      : this.title;
    let rep_icon = Field.quick("i", "bi bi-front px-2");
    if (this.repeatable) {
      viewer.querySelector("h5").appendChild(rep_icon);
    } else if (viewer.querySelector("h5").querySelector(".bi-front")) {
      viewer.querySelector("h5").querySelector(".bi-front").remove();
    }
  }
  /**
   * Create a MovingViewer for a field and add it to the editing section of the (mini-)schema.
   */
  view_field() {
    // identify the DOM element where the moving viewer will be inserted
    let field_box = this.schema.field_box;
    let moving_viewer = this.view();

    field_box.appendChild(moving_viewer.div);
    this.activate_autocomplete();

    // disable/re-enable the buttons of the existing viewers
    let viewers = field_box.querySelectorAll(".viewer");

    // if this new field is in the first place
    if (this.position === 0) {
      // disable its up-button
      moving_viewer.up.setAttribute("disabled", "");

      // re-enable the up-button of the field that was first before, if relevant
      if (viewers.length > 1) {
        viewers[1].querySelector(".up").removeAttribute("disabled");
      }
    }

    // if this new field is in the last place
    if (this.position === this.schema.fields.length - 1) {
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
    this.form_field.add_input("Description", this.get_domel_id("help"), {
      description:
        "Text to show as a description / help text for a field, like this text.",
      required: false,
      as_textarea: true,
      value: this.help,
      placeholder: "Helpful description",
    });
    let help = this.form_field.form.querySelector(
      `textarea#${this.get_domel_id("help")}`
    );
    help.addEventListener("change", () => {
      this.help_is_custom = true;
      this.update_help();
    });
  }

  get default_help() {
    return "";
  }

  get_domel_id(domel) {
    // domel = dom element (normally form fields)
    // examples: 'name', 'title', 'default', 'placeholder'
    // but also: 'viewer', 'editor'
    return `${this.id}-${domel}`;
  }

  update_help() {
    if (!this.help_is_custom && this.form_field) {
      this.help = this.default_help;
      let help_field = this.form_field.form.querySelector(
        `#${this.get_domel_id("help")}`
      );
      if (help_field != undefined) {
        help_field.value = this.help;
      }
    }
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
   * Remove the ID of a field from the regular expression that limits the possible names for the field,
   * to allow editing of a field.
   *
   * Create a regular expression template that identifies the field id from the string of IDs in the pattern
   * The output of providing this regex to the schema-level regex is five groups:
   * - start: Anything that goes before the field
   * - before: The character before: "!" if it's the first field, "|" otherwise
   * - match: The id of this field, preceded by "^" and followed by "$"
   * - after: The character right after: ")" if it's the last field, "|" otherwise
   * - end: The rest of the pattern
   * Then a concatenation of these fields is returned, removing 'match' and updating 'before'/'after' if necessary
   *
   * @param {String or RegExp} regex Regular expression defined at the schema level that limits
   *    the possible values of a field id. It includes the existing field.
   * @returns {String} Updated regular expression for the ID of this field, which excludes the name of the current field.
   */
  remove_id_from_regex(regex) {
    //
    let id_regex_template =
      "^(?<start>.+)(?<before>!|\\|)(?<match>\\^__FIELDID__\\$)(?<after>\\||\\))(?<end>.+$)";
    let regex_match = regex.match(
      new RegExp(id_regex_template.replace("__FIELDID__", this.name), "u")
    );
    if (regex_match == undefined) {
      return regex;
    }
    let { start, before, after, end } = regex_match.groups;

    if (before == "|") {
      // if this is not the first field, remove the "|" before
      before = "";
    } else if (after == "|") {
      // if this is the first field but not the last, remove the "|" afterwards
      after = "";
    } else {
      // if this is the last field, just provide the ending regex
      return `^(${end}`;
    }
    return start + before + after + end;
  }

  update_id_regex(new_regex) {
    this.id_regex = this.remove_id_from_regex(new_regex);
    if (this.form_field != undefined) {
      this.form_field.form.querySelector(
        `#${this.get_domel_id("name")}`
      ).pattern = this.id_regex;
    }
  }

  /**
   * Initialize a form to edit the field and add the components at the beginning of the form.
   */
  setup_form() {
    // create a new form
    this.form_field = new BasicForm(this.id);

    // add an input field to provide the ID of the field
    this.form_field.add_input(
      `ID for ${this.form_type} (underlying label)`,
      this.get_domel_id("name"),
      {
        description: description_text,
        value: this.name,
        validation_message: validation_text,
        pattern: this.id_regex,
      }
    );

    console.log("check: " + this.id_regex) // TO DO: Use for displaying existing field names.

    // add an input field to provide the title of the field
    this.form_field.add_input(
      `Label for ${this.form_type} (display name)`,
      this.get_domel_id("title"),
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
      let req_input = this.get_form_input("required")
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
      let dd_input = this.form_field.form.querySelector(
        `#${this.get_domel_id("dropdown")}`
      );
      dd_input.addEventListener("change", () => {
        this.values.ui =
          this.values.ui == "dropdown" ? this.dropdown_alt : "dropdown";
        this.values.ui == "dropdown"
          ? dd_input.setAttribute("checked", "")
          : dd_input.removeAttribute("checked");
      });
    } else {
      // define the behavior of the 'repeatable' switch
      let rep_input = this.get_form_input("repeatable");
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
      this.mode == "add" ? "Add" : "Update",
      "add"
    );
  }

  create_editor() {
    this.create_form();
    // create the modal
    let edit_modal = new Modal(
      this.get_domel_id("editor"),
      `${this.mode == "add" ? "Add" : "Edit"} ${this.button_title}`
    );

    // retrieve the form and add it to the modal
    let form = this.form_field.form;
    edit_modal.create_modal([form], "lg");

    // capture modal for manipulation
    let modal_dom = document.getElementById(this.get_domel_id("editor"));
    this.modal = bootstrap.Modal.getOrCreateInstance(modal_dom);

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
          let clone = this.register_fields();

          // ok the form
          form.classList.remove("was-validated");

          // close the modal
          this.modal.toggle();

          // recreate the updated (probably cleaned) form
          modal_dom.querySelector(".modal-body").appendChild(form);

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
    let modal = document.getElementById(this.get_domel_id("editor"));
    if (modal != null) {
      modal.remove();
    }
  }

  /**
   * Prepare and make a new instance of a field available when editing a schema.
   * @returns {HTMLDivElement} Element that contains an illustration example and a button to activate an editor modal.
   */
  render() {
    this.name = `${this.form_type}_temp`;

    // create the form to design the field and the modal that will host it
    this.create_editor();

    // append everything to a div
    return this.create_example();
  }

  setup_rendering_button(button, parent_modal) {
    button.setAttribute("data-bs-toggle", "modal");
    button.setAttribute("data-bs-target", "#" + this.get_domel_id("editor"));

  }

  // /**
  //  * Create a box for the options to create new fields.
  //  *
  //  * @param {HTMLElement} button Content for the box.
  //  * @returns {HTMLDivElement} Element containing a button to activate a modal or example.
  //  */
  // static example_box(button) {
  //   // append everything to a div
  //   let new_form = Field.quick("div", "shadow border rounded p-4 mb-3");
  //   new_form.appendChild(button);

  //   return new_form;
  // }

  /**
   * Create or update an input field and update the Schema it belongs to.
   * Read the data from the editing form of the field and either update the field or create a new one.
   * In the latter case, reset the original form so it can be used for new instances of the field.
   * @returns {InputField} Updated version of the input field.
   */
  register_fields() {
    let target = this.mode == "mod" ? this : this.clone(); // TODO check if it makes sense
    target.attach_schema(this.schema);
    target.recover_fields(this); // update the field

    if (this.mode == "mod") {
      target.update_field(); // update the schema
      return this;
    } else {
      // bring the current form, editor and contents to their original values
      this.reset();

      // set the mode of the new field, create form and modal that hosts the form
      target.create_editor();
      target.add_to_schema();

      // register new field in the schema
      return target;
    }
  }

  /**
   *
   * @returns {InputField} A new field with data from the form, to be added to the schema.
   */
  clone(add_suffix = false) {
    let clone = new this.constructor();

    // register the main info
    clone.name = this.name + (add_suffix ? "-new" : "");
    clone.title = this.title;
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
  recover_fields(original_field) {
    let data = new FormData(original_field.form_field.form);
    this.name = data.get(original_field.get_domel_id("name")).trim();
    this.title = data.get(original_field.get_domel_id("title")).trim();
    this.required = original_field.required;
    // capture the 'default' value if relevant
    if (this.required) {
      let default_value = data.get(original_field.get_domel_id("default"));
      if (default_value) {
        this.default = default_value.trim();
      }
    }
    let help = data.get(original_field.get_domel_id("help"));
    if (help) {
      this.help = help.trim();
    }
    return original_field.options_navbar ? original_field.temp_options : data;
  }

  /**
   * Create an Element to show and edit the field.
   * @returns {MovingViewer} Element to show and edit the field.
   */
  view() {
    return new MovingViewer(this);
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
   * @param {String} id ID of the field to create.
   * @param {FieldInfo} data Contents of the field to create.
   * @returns {InputField} The right input field with the data from the FieldInfo object.
   */
  static choose_class([name, data] = []) {
    let new_field;

    // if the type is 'object', create a composite field
    if (data.type == "object") {
      new_field = new ObjectInput();
    } else if (data.type == "select") {
      // if the type is 'select', create a multiple-value or single-value multiple choice, depending on the value of 'multiple'
      new_field = data.multiple
        ? new CheckboxInput()
        : new SelectInput();
    } else {
      // the other remaining option is the single field
      new_field = new TypedInput();
    }
    // fill in the basic information not present in the FieldInfo object
    new_field.name = name;
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
   */
  constructor() {
    super();
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

  update_field() {
    super.update_field();
    this.schema.field_box
      .querySelector(`#${this.get_domel_id("viewer")} .card-body`)
      .firstChild.replaceWith(this.viewer_input());
  }


  toggle_placeholder() {
    if (TypedInput.types_with_placeholder.indexOf(this.temp_values.type) > -1) {
      this.add_placeholder_field();
      return this.get_form_input("placeholder");
    } else if (this.get_form_div("placeholder")) {
      this.get_form_div("placeholder").remove();
      return undefined;
    }
  }

  toggle_default() {
    if (
      this.temp_values.type == "textarea" ||
      this.temp_values.type == "checkbox"
    ) {
      if (this.get_form_div("default")) {
        this.get_form_div("default").remove();
      }
      this.default = undefined;
    } else {
      this.add_default_field();
    }
    return this.get_form_input("default");
  }

  toggle_regex() {
    const placeholder_input = this.get_form_input("placeholder");
    const default_input = this.get_form_input("default");
    const regex_div = this.get_form_div("regex");
    if (TypedInput.types_with_regex.indexOf(this.temp_values.type) > -1) {
      this.add_regex_field();
      const regex_input = this.get_form_input("regex");
      regex_input.addEventListener("change", () => {
        placeholder_input.setAttribute("pattern", regex_input.value);
        default_input.setAttribute("pattern", regex_input.value);
        this.temp_values.pattern = regex_input.value;
        this.update_help();
      });
    } else if (regex_div) {
      regex_div.remove();
      if (placeholder_input != null) {
        placeholder_input.removeAttribute("pattern");
      }
      if (default_input != null) {
        default_input.removeAttribute("pattern");
      }
      this.temp_values.pattern = "";
      this.update_help();
    }
  }

  toggle_switches() {
    // disable or enable switches based on type (if they have already been created)
    let switches_div = this.form_field.form.querySelector("div#switches-div");
    if (switches_div) {
      let switches = switches_div.querySelectorAll('input[role="switch"]');
      if (this.temp_values.type == "checkbox") {
        this.required = false;
        this.repeatable = false;
        switches.forEach((sw) => {
          sw.setAttribute("disabled", "");
          sw.removeAttribute("checked");
        });
      } else {
        switches.forEach((sw) => sw.removeAttribute("disabled"));
      }
    }
  }

  make_numeric() {
    // if there is no field for minimum and maximum yet
    // (because the numeric type has just been selected via the dropdown)
    if (!this.get_form_input("min")) {
      // add input field for the minimum value
      this.form_field.add_input("Minimum", this.get_domel_id("min"), {
        placeholder: "0",
        value: this.values.minimum ? this.values.minimum : false, // value if it exists
        validation_message:
          "This field is compulsory and the value must be lower than the maximum.",
        required: false,
      });

      this.form_field.add_input("Maximum", this.get_domel_id("max"), {
        placeholder: "100",
        value: this.values.maximum ? this.values.maximum : false, // value if it exists
        validation_message:
          "This field is compulsory and the value must be higher than the minimum.",
        required: false,
      });
    }

    ["placeholder", "default", "min", "max"].forEach((input_key) => {
      const input = this.get_form_input(input_key);
      if (input) {
        input.type = "number";
        if (this.temp_values.min && input_key != "min") {
          input.min = this.temp_values.min;
        }
        if (this.temp_values.max && input_key != "max") {
          input.max = this.temp_values.max;
        }
        if (this.temp_values.type == "float") {
          input.setAttribute("step", "any");
        }
      }
    });
    // REVIEW THIS FUNCTION AND THE NEXT
    // adapt minima of maximum and default fields when a new minimum is provided
    const min_button = this.get_form_input("min");
    const max_button = this.get_form_input("max");
    min_button.addEventListener("change", () => {
      ["placeholder", "default", "max"].forEach((input_key) => {
        const input = this.get_form_input(input_key);
        if (input) {
          input.min = min_button.value;
        }
      });
      this.temp_values.min = min_button.value;
      this.update_help();
    });
    max_button.addEventListener("change", () => {
      ["placeholder", "default", "min"].forEach((input_key) => {
        const input = this.get_form_input(input_key);
        if (input) {
          input.max = max_button.value;
        }
      });
      this.temp_values.max = max_button.value;
      this.update_help();
    });
  }
  unmake_numeric() {
    // Have a minimum or maximum values been defined?
    const has_range =
      this.values.minimum != undefined || this.values.maximum != undefined;
    const placeholder_input = this.get_form_input("placeholder");
    const default_input = this.get_form_input("default");

    if (this.get_form_div("min")) {
      this.get_form_div("min").remove();
      this.get_form_div("max").remove();
    }

    // if minimum and maximum values had been provided
    if (has_range) {
      delete this.values.minimum;
      delete this.values.maximum;
    }

    // adapt the type of the default input
    if (placeholder_input) {
      placeholder_input.type =
        this.temp_values.type == "textarea" ? "text" : this.temp_values.type;
      ["min", "max", "step"].forEach((val) =>
        placeholder_input.removeAttribute(val)
      );
    }

    // adapt the type of the default input
    if (default_input) {
      default_input.type = this.temp_values.type;
      ["min", "max", "step"].forEach((val) =>
        default_input.removeAttribute(val)
      );
    }
  }

  toggle_numeric() {
    (this.temp_values.type == "integer") | (this.temp_values.type == "float")
      ? this.make_numeric()
      : this.unmake_numeric();
  }

  /**
   * Handle the input fields and values dependent on specific types of simple fields.
   * If a field editor is generated for the first time, include the appropriate fields.
   * If a different type is chosen while editing the field, add/remove the appropriate fields.
   */
  manage_format() {
    const placeholder_input = this.toggle_placeholder();
    const default_input = this.toggle_default();

    this.toggle_regex();
    this.toggle_switches();
    this.toggle_numeric();
    // add or remove range inputs based on type

    // adapt the description of the default input field based on the type
    const validator = this.default_help.replace(
      "Input type: ",
      "This field must be of type "
    );
    if (placeholder_input) {
      placeholder_input.parentElement.querySelector(
        ".invalid-feedback"
      ).innerHTML = validator;
    }

    // adapt the description of the default input field based on the type
    if (default_input) {
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
    if (data.help) {
      this.help_is_custom = this.help != this.default_help;
    }
    this.update_help();
  }

  get default_help() {
    let par_text =
      (this.temp_values.type == "integer") | (this.temp_values.type == "float") // if it's a number
        ? " " + this.print_range() // specify the range
        : this.temp_values.pattern != undefined && // if it has a pattern
          this.temp_values.pattern.length > 0
          ? ` fully matching /${this.temp_values.pattern}/` // specify the pattern
          : "";
    return `Input type: ${this.temp_values.type}${par_text}`;
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
    if (this.get_form_div("placeholder") == undefined) {
      this.form_field.add_input("Placeholder", this.get_domel_id("placeholder"), {
        description: "Example of a value for this field.",
        value: this.values.placeholder,
        required: false,
      });
      let placeholder_div = this.get_form_div("placeholder");
      let divider = this.form_field.form.querySelector(
        `hr#${this.get_domel_id("divider")}`
      );
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
    if (this.get_form_div("regex") == undefined) {
      const regex_input_docs =
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/pattern#constraint_validation";
      const regex_explanation = `A regular expression to use in validation: the <a href="${regex_input_docs}">match has to be complete, not partial</a>.`;
      this.form_field.add_input("Regex pattern", this.get_domel_id("regex"), {
        description: regex_explanation,
        value: this.values.pattern,
        required: false,
      });
      let regex_div = this.get_form_div("regex");
      let placeholder_div = this.get_form_div("placeholder");
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
    if (this.get_form_div("default")) {
      this.form_field.add_input("Default value", this.get_domel_id("default"), {
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
    subtitle.id = this.get_domel_id("help");

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
      input_input.id = this.get_domel_id("check");
      let input_label = Field.quick(
        "label",
        "form-check-label visually-hidden",
        "Check if true."
      );
      input_label.setAttribute("for", this.get_domel_id("check"));
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
      const is_required_msg = this.required ? "This field is required. " : "";
      const condition =
        input.type == "number"
          ? " " + this.print_range() // if it's a number, message about the range
          : this.values.pattern != undefined && this.values.pattern.length > 0 // otherwise if there is a regex pattern...
            ? ` matching the regular expression /^${this.values.pattern}$/`
            : "";
      const validator_message = Field.quick(
        "div",
        "invalid-feedback",
        `${is_required_msg}Please provide a ${this.type}${condition}.`
      );
      div.appendChild(validator_message);
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
      this.get_domel_id("format"),
      TypedInput.text_options,
      this.type
    );

    // when selecting from the dropdown, adapt the contents of the form
    const format_select = this.form_field.form.querySelector("#" + this.get_domel_id("format"));
    format_select.addEventListener("change", () => {
      this.temp_values.type = format_select.value;
      this.manage_format();
    });

    let divider = document.createElement("hr");
    divider.id = this.get_domel_id("divider");
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
   * @param {String} new_id ID for the clone.
   * @param {String} title User-facing label of the clone, retrieved from the form
   * @returns {InputField} A new field with data from the form, to be added to the schema.
   */
  clone(add_suffix = false) {
    let clone = super.clone(add_suffix);
    clone.type = this.type;
    clone.temp_values = { ...this.temp_values };
    return clone;
  }

  /**
   * Read the form used to edit the field and register the values (on submission).
   * @param {FormData} data Contents of the editing form of the field.
   */
  recover_fields(field) {
    const data = super.recover_fields(field);
    // capture type
    this.type = data.get(field.get_domel_id("format"));

    // capture minimum and maximum values if relevant
    if ((this.type === "integer") | (this.type == "float")) {
      let minimum = data.get(field.get_domel_id("min"));
      let maximum = data.get(field.get_domel_id("max"));
      if (minimum) this.values.minimum = minimum.trim();
      if (maximum) this.values.maximum = maximum.trim();
    }

    if (TypedInput.types_with_placeholder.indexOf(this.type) > -1) {
      let placeholder = data.get(field.get_domel_id("placeholder"));
      this.values.placeholder = placeholder.trim();
    } else {
      this.values.placeholder = "";
    }
    if (TypedInput.types_with_regex.indexOf(this.type) > -1) {
      let pattern = data.get(field.get_domel_id("regex"));
      if (pattern != undefined) this.values.pattern = pattern.trim();
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
    if (this.get_form_div("max") != null) {
      this.get_form_div("max").remove();
      this.get_form_div("min").remove();
    }
    if (this.get_form_div("placeholder") != null) {
      this.get_form_input("placeholder").type = "text";
    }
    if (this.get_form_div("default") != undefined) {
      this.get_form_input("default").type = "text";
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
 * @property {ObjectEditor} minischema Mini-schema containing the InputFields corresponding to the components of the composite field
 * @property {FieldInfo} json_source Contents coming from a JSON file, used to fill in the `editor`.
 */
class ObjectInput extends InputField {

  form_type = "object";
  button_title = "Composite field";
  description =
    "This can contain any combination of the previous form elements.<br>";

  /**
   * Create and link a mini-schema (ObjectEditor) to contain the subfields.
   */
  init_minischema() {
    // If it doesn't exist, create a new ObjectEditor, otherwise just update the id of the form
    if (this.minischema == undefined) {
      this.minischema = new ObjectEditor(this);
    }
    // Assign the id of the modal as the hook of the editor
    this.minischema.card_id = this.get_domel_id("editor");
    this.minischema.name = this.name;
    // if there is existing data, fill in the editor
    if (this.json_source != undefined) {
      this.minischema.from_json(this.json_source);
    }
    if (this.schema) {
      this.minischema.prefix = this.schema.prefixed;
    }
  }

  /**
   * Turn the relevant fields into an Object to be saved in a JSON file, based on the contents of `editor`.
   * Overrides the parent version.
   * @returns {FieldInfo} JSON representation of the contents of the field.
   */
  to_json() {
    // Update `this.minischema.properties` with the Object version of its subfields
    this.minischema.fields_to_json();
    // create the object
    let json = {
      title: this.title,
      properties: this.minischema.properties,
      type: "object",
    };

    json.required = this.required;
    json.repeatable = this.repeatable;
    json.help = this.help;

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
    if (data.help) {
      this.help_is_custom = this.help != this.default_help;
    }
    this.update_help(); // again now that we have the fields
  }

  get default_help() {
    return `Nested form with ${this.minischema ? this.minischema.fields.length : " "
      }subfields that go together.`;
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
    this.minischema.viewer = ComplexField.create_viewer(
      this.minischema,
      active
    );
    return this.minischema.viewer;
  }

  /**
   * Create a form to edit the field.
   * Between setup and ending, create and link an ObjectEditor and fill it with existing data.
   */
  create_form() {
    // setup the form
    this.setup_form();

    // create and link an ObjectEditor (mini-schema)
    this.init_minischema();

    // finish the form
    this.end_form();
    this.form_field.rowsub
      .querySelector("button#add")
      .setAttribute("disabled", "");
    this.form_field.form.querySelectorAll("input,textarea").forEach((input) => {
      input.addEventListener("change", () => {
        this.minischema.add_wip(input.id);
      });
    });

    // insert the 'add element' button before the switches
    const switches = this.form_field.form.querySelector("#switches-div");
    this.minischema.add_field_box(switches);
  }

  // /**
  //  * Create a modal to host the form to edit the field and define what happens when the form is "submitted".
  //  */
  create_editor() {
    this.create_form();
    this.minischema.fields.forEach((field) => field.view_field());
    // this.view_field();

    const form = this.form_field.form;
    this.form_field.add_submit_action("add", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add("was-validated");
      } else {
        form.classList.remove("was-validated");
        this.register_fields();
        this.minischema.reset_wip();
        this.schema.add_wip(this.id);
      }
    });

  }

  attach_schema(schema) {
    super.attach_schema(schema);

  }

  render() {
    return this.create_example();
  }

  setup_rendering_button(button, parent_modal) {

    button.addEventListener("click", () => {
      const clone = new ObjectInput();
      clone.attach_schema(this.schema);
      clone.create_editor();
      clone.name = "composite-temp";
      clone.title = "TEMPORARY COMPOSITE FIELD";
      clone.add_to_schema();
      parent_modal.hide();
    });
  }

  register_fields() {
    this.recover_fields(this);
    this.form_field.form.parentElement.parentElement.querySelector(
      ".card-header h5"
    ).innerHTML = this.title;
    this.minischema.prefix = this.schema.prefixed;
    this.minischema.name = this.name;;
  }

  update_field() {
    super.update_field();
    this.get_form_input("title").value = this.title;
    this.get_form_input("repeatable") = this.repeatable;
    document.querySelector(`textarea#${this.get_domel_id("help")}`).value = this.help
      ? this.help
      : "";
  }

  /**
   * Bring the field and its form back to the original settings.
   */
  reset() {
    // reset the form and field
    super.reset();
    this.form_field.form.querySelectorAll(".viewer").forEach((card) => {
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
   */
  constructor() {
    super();
    this.type = "select";
    this.values.values = [];
  }

  repeatable = false;
  static max_before_autocomplete = 10;

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
    if (data.help) {
      this.help_is_custom = this.help != this.default_help;
    }
    this.update_help();
  }

  get default_help() {
    return `Choose ${this.values.multiple ? "at least " : ""}one of ${this.temp_options.length
      } options.`;
  }

  update_field() {
    super.update_field();
    this.schema.field_box
      .querySelector(`#${this.get_domel_id("viewer")} .card-body`)
      .firstChild.replaceWith(this.viewer_input());
    this.activate_autocomplete();
  }

  /**
   * Create an element with the right type of input field, either to view in a schema-view or to fill in annotation.
   * @param {Boolean} active Whether the form is meant to be used in annotation.
   * @returns {HTMLDivElement}
   */
  viewer_input(active = false) {
    let div = document.createElement("div");
    let form_shape;
    let with_autocomplete = false;

    // get actual input field
    if (this.values.values.length > MultipleInput.max_before_autocomplete) {
      // if we have so many values we go for a search gox
      form_shape = Field.autocomplete(this, active);
      if (this.values.multiple) {
        // if many values are possible
        this.answers_div = Field.quick("div", "my-2");
        this.answers_div.id = `${this.get_domel_id("answers")}`;
      }
      with_autocomplete = true;
    } else {
      form_shape =
        this.values.ui == "dropdown"
          ? Field.dropdown(this, active)
          : Field.checkbox_radio(this, active);
    }

    // create description
    if (this.help) {
      let subtitle = Field.quick("div", "form-text mt-0 mb-1", this.help);
      subtitle.id = this.get_domel_id("help");
      div.appendChild(subtitle);

      if (with_autocomplete || this.values.ui == "dropdown") {
        form_shape.setAttribute("aria-describedby", subtitle.id);
      } else {
        form_shape.querySelectorAll("div.form-check").forEach((subdiv) => {
          subdiv
            .querySelector(".form-check-input")
            .setAttribute("aria-describedby", subtitle.id);
        });
      }
    }

    // add field for multiple answers for search box, if relevant
    if (this.answers_div) {
      div.appendChild(this.answers_div);
    }
    div.appendChild(form_shape);

    // add validation message
    if (active) {
      div.appendChild(this.validator_message);
    }

    return div;
  }

  get validator_message() {
    const is_required_msg = this.required ? "This field is required. " : "";
    return Field.quick(
      "div",
      "invalid-feedback",
      `${is_required_msg}Please provide ${this.values.multiple ? "at least " : ""
      }one of the accepted options.`
    );
  }

  get autocomplete_selector() {
    return document.getElementById(this.get_domel_id("search"));
  }

  activate_autocomplete() {
    if (this.autocomplete_selector == null) {
      return undefined;
    }
    const autocomplete = new autoComplete({
      selector: () => {
        return this.autocomplete_selector;
      },
      placeHolder: this.default != undefined ? this.default : "Search...",
      data: { src: this.values.values, cache: true },
      resultsList: {
        element: (list, data) => {
          if (!data.results.length) {
            const msg = Field.quick(
              "div",
              "no_result",
              `<span>No results found</span>`
            );
            list.prepend(msg);
          }
        },
        noResults: true,
        maxResults: 20,
      },
      resultItem: {
        highlight: true,
      },
    });
    this.autocomplete_selector.parentElement.appendChild(this.validator_message);

  }

  read_autocomplete() {
    const autocomplete_field = this.autocomplete_selector;

    if (this.autocomplete_selector == undefined) {
      return undefined;
    }
    if (this.values.multiple) {
      const answers_div = Field.quick("div", "my-2");
      autocomplete_field.parentElement.prepend(answers_div);
      autocomplete_field.removeAttribute("name");
      autocomplete_field.addEventListener("selection", (event) => {
        const [pill, label] = Field.autocomplete_checkbox(
          event.detail.selection.value,
          this.name
        );
        answers_div.appendChild(pill);
        answers_div.appendChild(label);
        autocomplete_field.value = "";
      });
    } else {
      autocomplete_field.addEventListener("selection", (event) => {
        autocomplete_field.blur();
        // Prepare User's Selected Value
        autocomplete_field.value = event.detail.selection.value;
      });
    }
    autocomplete_field.addEventListener("close", (event) => {
      if (event.detail.matches == 0) {
        autocomplete_field.value = "";
      }
    });
  }

  /**
   * Create a form to edit the field.
   * Between setup and ending, add moving options depending on the existing values.
   */
  create_form() {
    // Setup form
    this.setup_form();

    const nav_bar_container = Field.quick("div", "shadow p-2 rounded");
    this.options_navbar = new NavBar(this.get_domel_id("optionstab"), [
      "nav-pills",
      "nav-justified",
    ]);
    this.add_moving_options();

    const options_as_text =
      this.values.values.length > 0
        ? this.values.values.join("\n")
        : "Option 1\nOption 2";

    this.add_textarea_options(options_as_text);
    this.add_file_options(options_as_text);
    nav_bar_container.appendChild(this.options_navbar.nav_bar);
    nav_bar_container.appendChild(this.options_navbar.tab_content);
    this.options_navbar.nav_bar.childNodes.forEach((nav_item) => {
      nav_item.querySelector("button").addEventListener("shown.bs.tab", () => {
        if (
          this.form_field.form.querySelector(
            `select#${this.get_domel_id("default")}`
          ) !== undefined
        ) {
          this.relevant_id = nav_item.querySelector("button").id.split("-")[0];
          this.update_default_field();
        }
        this.toggle_dropdown_switch();
      });
    });
    this.form_field.add_editor(nav_bar_container);
    // Finish form
    this.end_form();
    this.toggle_dropdown_switch();
  }

  add_moving_options() {
    this.options_navbar.add_item("movers", "Edit individual options", true);

    const moving_div = Field.quick("div", "mover-container");
    moving_div.setAttribute("style", "max-height:300px;overflow:auto;");
    // Add moving input fields to design the options
    this.form_field.add_moving_options(this, moving_div);
    this.options_navbar.add_tab_content("movers", moving_div);
    this.listen_to_movers(moving_div);
  }

  listen_to_movers(moving_div) {
    moving_div.querySelectorAll("input.mover").forEach((input) => {
      input.addEventListener("change", () => {
        this.toggle_editing_navbar("movers");
        this.toggle_dropdown_switch();
        this.update_default_field();
        this.update_help();
        this.alert_repeated_movers(moving_div);
      });
    });
    moving_div.querySelectorAll("button.rem").forEach((input) => {
      input.addEventListener("click", () => {
        this.toggle_dropdown_switch();
        this.update_help();
        this.alert_repeated_movers(moving_div);
      });
    });
    moving_div.querySelectorAll("button.mover").forEach((input) => {
      input.addEventListener("click", () => {
        this.update_default_field();
      });
    });
  }

  alert_repeated_movers(moving_div) {
    const current_values = [...moving_div.querySelectorAll("input.mover")]
      .map((x) => x.value)
      .filter((x) => x.length > 0);
    const parent = moving_div.parentElement;
    let msg_row = parent.querySelector("#repeated-values");
    if ([...new Set(current_values)].length < current_values.length) {
      const repeated_values = [
        ...new Set(
          current_values.filter(
            (x) => current_values.filter((y) => y == x).length > 1
          )
        ),
      ];
      const msg = `  The following values are repeated: ${repeated_values.join(
        ", "
      )}. Only one instance of each will be kept.`;

      if (msg_row != null) {
        msg_row.remove();
      }

      msg_row = Field.quick(
        "div",
        "row justify-content-between alert alert-info p-2 m-1 shadow align-items-center"
      );
      msg_row.id = "repeated-values";
      const col_left = Field.quick("main", "col-8 p-0 m-0");
      const col_right = Field.quick("aside", "col-3 p-0 m-0");
      msg_row.appendChild(col_left);
      msg_row.appendChild(col_right);

      const icon = Field.quick("i", "bi bi-info-circle-fill");
      icon.setAttribute("fill", "currentColor");
      col_left.appendChild(icon);

      let msg_box = Field.quick("span", "", msg);
      msg_box.setAttribute("role", "alert");
      msg_box.id = "repeated-warning";
      col_left.appendChild(msg_box);

      let btn = Field.quick(
        "button",
        "btn btn-info fw-bold",
        "Delete duplicates"
      );
      // btn.setAttribute("style", "cursor: pointer;");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const repeated_indices = repeated_values
          .map((x) => {
            return current_values
              .map((y, i) => {
                return y == x ? i : "other";
              })
              .filter((x) => x != "other")
              .slice(1);
          })
          .flat();
        parent.querySelectorAll(".blocked").forEach((x, i) => {
          if (repeated_indices.indexOf(i) > -1) {
            x.remove();
          }
        });

        msg_row.remove();

        this.toggle_dropdown_switch();
        this.update_default_field();
        this.update_help();
      });
      col_right.appendChild(btn);

      parent.insertBefore(msg_row, moving_div);
    } else {
      if (msg_row != null) {
        msg_row.remove();
      }
    }
  }

  add_textarea_options(options_as_text) {
    this.options_navbar.add_item("textarea", "Edit in a text box");
    const description = "Type or paste your options, one per line.";
    const textarea_div = this.form_field.add_input(
      "Type options",
      this.get_domel_id("typed"),
      {
        description: description,
        required: false,
        value: this.values.values.length > 0 ? options_as_text : false,
        as_textarea: true,
        placeholder: options_as_text,
      },
      false
    );
    const textarea = textarea_div.querySelector("textarea");
    textarea.setAttribute("rows", 6);
    textarea.setAttribute("name", "typed-options");
    textarea.addEventListener("change", () => {
      const fixed_value = textarea.value
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      textarea.value = [...new Set(fixed_value)].join("\n");
      this.update_default_field();
      this.update_help();
      this.toggle_dropdown_switch();
      this.toggle_editing_navbar("textarea", options_as_text);
    });
    this.options_navbar.add_tab_content("textarea", textarea_div);
  }

  add_file_options(options_as_text) {
    this.options_navbar.add_item("file", "Upload text file");

    const reader = new FileReader();
    reader.onload = () => {
      const options = reader.result
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      dd_example.innerHTML = [...new Set(options)].join("\n");
      this.update_default_field();
      this.update_help();
      this.toggle_dropdown_switch();
      this.toggle_editing_navbar("file", options_as_text);
    };

    let file_div = Field.quick("div", "ex my-2");
    const file_input_id = this.get_domel_id("optionsfile");

    let label = Field.quick(
      "label",
      "form-label",
      "Choose a file or drag and drop into the field below."
    );
    label.setAttribute("for", file_input_id);

    let input = Field.quick("input", "form-control");
    input.id = file_input_id;
    input.type = "file";
    input.setAttribute("accept", ".txt,.csv,.md");
    input.addEventListener("change", (e) => {
      reader.readAsText(e.target.files[0]);
    });

    let explanation = Field.quick(
      "div",
      "form-text",
      "Plain text file with one option per row. This will REPLACE existing values."
    );
    explanation.id = file_input_id + "-help";

    let dd_example = Field.quick("pre", "border p-1 bg-light", options_as_text);
    dd_example.setAttribute(
      "style",
      "width:700px; white-space: pre-wrap; max-height:200px;"
    );
    dd_example.addEventListener("dragover", (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    dd_example.addEventListener("drop", (e) => {
      e.stopPropagation();
      e.preventDefault();
      reader.readAsText(e.dataTransfer.files[0]);
    });

    file_div.appendChild(label);
    file_div.appendChild(input);
    file_div.appendChild(explanation);
    file_div.appendChild(dd_example);

    this.options_navbar.add_tab_content("file", file_div);
  }

  toggle_editing_navbar(active_id, options_as_text = "") {
    this.options_navbar.nav_bar.querySelectorAll("button").forEach((btn) => {
      if (!btn.id.startsWith(active_id)) {
        btn.setAttribute("disabled", "");
      }
    });
    const active_tab = this.options_navbar.tab_content.querySelector(
      `[id^="${active_id}"]`
    );

    if (active_tab.querySelector("#in-editing") == undefined) {
      const msg_row = Field.quick(
        "div",
        "row justify-content-between alert alert-warning p-2 m-1 shadow align-items-center"
      );
      msg_row.id = "in-editing";
      const col_left = Field.quick("main", "col-8 p-0 m-0");
      const col_right = Field.quick("aside", "col-2 p-0 m-0");
      msg_row.appendChild(col_left);
      msg_row.appendChild(col_right);

      const icon = Field.quick("i", "bi bi-pencil-fill");
      icon.setAttribute("fill", "currentColor");
      col_left.appendChild(icon);

      let msg_box = Field.quick(
        "span",
        "",
        "  You are editing this tab, all other tabs are disabled.  "
      );
      msg_box.setAttribute("role", "alert");
      msg_box.id = "autosave-warning";
      col_left.appendChild(msg_box);

      let btn = Field.quick("button", "btn btn-warning fw-bold", "Reset");
      // btn.setAttribute("style", "cursor: pointer;");
      btn.addEventListener("click", () => {
        msg_row.remove();
        this.options_navbar.nav_bar
          .querySelectorAll("button")
          .forEach((btn) => btn.removeAttribute("disabled"));
        if (active_id == "textarea") {
          active_tab.querySelector("textarea").value =
            this.values.values.length > 0 ? options_as_text : "";
        } else if (active_id == "file") {
          active_tab.querySelector("input").value = "";
          active_tab.querySelector("pre").innerHTML = options_as_text;
        } else if (active_id == "movers") {
          active_tab
            .querySelectorAll("div.blocked, button")
            .forEach((div) => div.remove());
          this.form_field.add_moving_options(
            this,
            active_tab.querySelector(".mover-container")
          );
          this.listen_to_movers(active_tab.querySelector(".mover-container"));
        }

        this.toggle_dropdown_switch();
        this.update_default_field();
        this.update_help();
      });
      col_right.appendChild(btn);

      active_tab.prepend(msg_row);
    }
  }

  toggle_dropdown_switch() {
    const temp_options = this.temp_options;
    if (this.form_field.switches) {
      if (temp_options.length > MultipleInput.max_before_autocomplete) {
        this.form_field.switches
          .querySelector("input[id$='dropdown']")
          .setAttribute("disabled", "");
      } else {
        this.form_field.switches
          .querySelector("input[id$='dropdown']")
          .removeAttribute("disabled");
      }
    }
  }

  get temp_options() {
    let relevant_tab, raw_list;

    if (!this.options_navbar) {
      return this.values.values;
    }
    if (this.relevant_id) {
      relevant_tab = this.options_navbar.tab_content.querySelector(
        `[id^="${this.relevant_id}"]`
      );
    } else {
      relevant_tab = this.options_navbar.tab_content.querySelector("div.show");
      this.relevant_id = relevant_tab.id.split("-")[0];
    }
    if (this.relevant_id.startsWith("textarea")) {
      const textarea = relevant_tab.querySelector("textarea").value;
      raw_list = textarea.split("\n");
    } else if (this.relevant_id.startsWith("movers")) {
      const moving_fields = relevant_tab.querySelectorAll("div.blocked input");
      raw_list = [...moving_fields].map((option) => option.value);
    } else if (this.relevant_id.startsWith("file")) {
      const file_contents = relevant_tab.querySelector("pre").innerHTML;
      raw_list = file_contents.split("\n");
    }
    return [...new Set(raw_list)];
  }

  /**
   * Read the form used to edit the field and register the values (on submission).
   * @param {FormData} data Contents of the editing form of the field.
   */
  recover_fields(field) {
    const data = super.recover_fields(field);
    // reset whatever values existing
    this.values.values = data.map((x) => x.trim()).filter((x) => x.length > 0);

    // if the form in the modal already exists
    if (this.form_field) {
      if (!this.relevant_id.startsWith("textarea")) {
        this.options_navbar.tab_content.querySelector("textarea").value =
          this.values.values.join("\n");
      }
      if (!this.relevant_id.startsWith("movers")) {
        const moving_div = this.options_navbar.tab_content.querySelector(
          "div.mover-container"
        );
        moving_div
          .querySelectorAll("div.blocked, div.mover")
          .forEach((x) => x.remove());
        this.form_field.add_moving_options(this, moving_div);
      }
      const values_as_text = this.values.values.join("\n");
      if (!this.relevant_id.startsWith("textarea")) {
        this.options_navbar.tab_content.querySelector("textarea").value =
          values_as_text;
      }
      if (!this.relevant_id.startsWith("file")) {
        this.options_navbar.tab_content.querySelector("pre").innerHTML =
          values_as_text;
      }


      let default_field = this.form_field.form.querySelector(`select#${this.get_domel_id("default")}`);
      if (default_field !== null) {
        let selected = default_field.querySelector("option[selected]");
        let selected_value = selected == null ? null : selected.value.trim();
        default_field.querySelectorAll("option").forEach((x) => x.remove());
        for (let val of this.values.values) {
          let new_option = document.createElement("option");
          new_option.value = val;
          new_option.innerHTML = val;
          if (selected_value != null && val == selected_value) {
            new_option.setAttribute("selected", "");
          }
          default_field.appendChild(new_option);
        }
      }
    }


  }

  update_default_field() {
    return;
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
    this.relevant_id = "movers";
    this.values.values = [];
    super.reset();
    this.options_navbar.nav_bar.querySelectorAll("button").forEach((btn) => {
      btn.removeAttribute("disabled");
      if (btn.id.startsWith("movers")) {
        bootstrap.Tab.getOrCreateInstance(btn).show();
      }
    });
    this.options_navbar.tab_content.querySelector("#in-editing").remove();
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
   */
  constructor() {
    super();
    this.values.multiple = false;
    this.values.ui = "radio";
  }

  form_type = "selection";
  button_title = "Single-value multiple choice";
  dropdown_alt = "radio";

  /**
   * If relevant, create and add a dropdown for the default value.
   * The dropdown options do not adapt as you edit the possible options because that's too much work.
   * But once you have saved your input, the next edit will offer the right options.
   */
  add_default_field() {
    if (typeof this.values.values == "object") {
      this.form_field.add_select(
        "Default value (if field is required)",
        this.get_domel_id("default"),
        this.values.values,
        this.default
      );
    }
  }

  update_default_field() {
    let default_field = this.form_field.form.querySelector(
      `select#${this.get_domel_id("default")}`
    );
    if (typeof this.temp_options == "string") {
      default_field.setAttribute("disabled", "");
    } else {
      default_field.removeAttribute("disabled");

      let selected = default_field.value;
      default_field
        .querySelectorAll("option:not([value=''])")
        .forEach((option) => option.remove());
      const new_fields = this.temp_options;

      if (
        selected &&
        new_fields.indexOf(selected) == -1 &&
        default_field.querySelectorAll("option").length == 0
      ) {
        selected = "";
        let empty_option = document.createElement("option");
        empty_option.innerHTML = "Select option below";
        empty_option.value = "";
        default_field.appendChild(empty_option);
      }

      new_fields.forEach((option) => {
        if (option) {
          let option_field = document.createElement("option");
          option_field.innerHTML = option;
          option_field.value = option;
          if (option == selected) option_field.setAttribute("selected", "");
          default_field.appendChild(option_field);
        }
      });
    }
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
   */
  constructor() {
    super();
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
