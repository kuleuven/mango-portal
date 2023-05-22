/**
 * Class for HTML DOM utilities. Only static methods.
 */
class Field {
  /**
   * Create an HTML element with a certain class and maybe text.
   * @static
   * @param {String} tag Tag Name for the HTML element.
   * @param {String} class_name Class name for the HTML element.
   * @param {String} [inner=null] Text to be added inside the HTML element.
   * @returns {HTMLElement} An HTML element with the provided tag name, class and (optionally) internal text.
   */
  static quick(tag, class_name, inner = null) {
    let el = document.createElement(tag);
    el.className = class_name;
    if (inner != null) {
      el.innerHTML = inner;
    }
    return el;
  }

  /**
   * Example values for example dropdowns/checkboxes/radios
   * @type {String[]}
   */
  static example_values = ["A", "B", "C"];

  /**
   * Create a BS5 Select input.
   * @static
   * @param {MultipleInput} field Input field to build a dropdown upon.
   * @param {Boolean} [active=false] Whether it will be used for annotation.
   * @returns {HTMLElement} A dropdown (select input).
   */
  static dropdown(field, active = false) {
    let { multiple, values } = field.values;
    let inner_input = Field.quick("select", "form-select");
    if (multiple) {
      // if it's multiple-value
      inner_input.setAttribute("multiple", "");
    }
    // if there are values, use them, otherwise go for the basic examples
    values = values ? values : Field.example_values;

    // if this will be used for annotation
    if (active && !field.required) {
      let empty_option = document.createElement("option");
      inner_input.appendChild(empty_option);
    }

    for (let i of values) {
      let new_option = document.createElement("option");
      new_option.value = i;
      new_option.innerHTML = i;
      inner_input.appendChild(new_option);
    }
    // if this will be used for annotation
    if (active) {
      inner_input.name = field.name;
      if (field.required) {
        inner_input.setAttribute("required", "");
      }
    }

    let value = Field.include_value(field);
    if (
      value != undefined &&
      inner_input.querySelector(`option[value="${value}"]`)
    ) {
      // check that the value still exists!
      inner_input
        .querySelector(`option[value="${value}"]`)
        .setAttribute("selected", "");
    }
    return inner_input;
  }

  /**
   * Create a BS5 checkbox or radio input.
   * @static
   * @param {MultipleInput} field Input field to build a dropdown upon.
   * @param {Boolean} [active=false] Whether it will be used for annotation.
   * @returns {HTMLElement} A checkbox or radio input.
   */
  static checkbox_radio(field, active = false) {
    let { multiple, values } = field.values;
    values = values ? values : Field.example_values;
    let inner_input = document.createElement("div");
    let value = Field.include_value(field);
    for (let i of values) {
      let new_option = Field.quick("div", "form-check input-view");

      let new_input = Field.quick("input", "form-check-input");
      new_input.type = multiple ? "checkbox" : "radio";
      new_input.value = i;
      new_input.id = `check-${i}`;

      if (active) {
        new_input.name = field.name;
      }

      if (value) {
        let this_is_the_value = multiple ? value.indexOf(i) > -1 : value == i;
        if (this_is_the_value) {
          new_input.setAttribute("checked", "");
        }
      }

      let new_label = Field.quick("label", "form-check-label", i);
      new_label.setAttribute("for", `check-${i}`);

      new_option.appendChild(new_input);
      new_option.appendChild(new_label);
      inner_input.appendChild(new_option);
    }
    return inner_input;
  }

  /**
   * Quickly create a label for an input field.
   * @static
   * @param {String} label_text Text for the input label.
   * @param {String} input_id ID of the input this label describes.
   * @returns {HTMLElement} A label for an input field.
   */
  static labeller(label_text, input_id) {
    let label = Field.quick("label", "form-label h6", label_text);
    label.id = `label-${input_id}`;
    label.setAttribute("for", input_id);

    return label;
  }

  /**
   * Check if a value has been provided for a field, or otherwise a default, and retrieve it.
   * @param {InputField} field Field from which the value will be extracted
   * @returns An existing value, or a default value, or nothing.
   */
  static include_value(field) {
    if (field.value != undefined) {
      return field.value;
    } else if (field.required && field.default != undefined) {
      return field.default;
    } else {
      return;
    }
  }
}

/**
 * Class representing a form element or field that can move up and down among others of its kind.
 * @property {String|Number} idx Index or identifier of this field in relation to its siblings.
 * @property {HTMLButtonElement} up Button used to move the field one slot up.
 * @property {HTMLButtonElement} down Button used to move the field one slot down.
 */
class MovingField {
  /**
   * Initiate a moving field.
   * @class
   * @param {String|Number} idx Index or identifier of this field in relation to its siblings.
   */
  constructor(idx) {
    this.idx = idx;
    this.up = this.add_btn("up", "arrow-up-circle", () => this.move_up());
    this.down = this.add_btn("down", "arrow-down-circle", () =>
      this.move_down()
    );
  }

  /**
   * Move the field one slot up.
   * @abstract
   */
  move_up() {
    return;
  }

  /**
   * Move the field one slot down.
   * @abstract
   */
  move_down() {
    return;
  }

  /**
   * Create a button for the Moving Field.
   * @param {String} className Class name for the button indicating its function ('up', 'down', 'edit'...).
   * @param {String} symbol Name of the Bootstrap Icon symbol to use in the button ('arrow-up-circle', 'arrow-down-circle'...).
   * @param {Function} [action=false] What the button must do on click. If 'false', nothing happens.
   * @returns {HTMLButtonElement} The button to be added.
   */
  add_btn(className, symbol, action = false) {
    // use outlines for MovingViewer and filled buttons for MovingChoice
    let button_color =
      this.constructor.name == "MovingViewer"
        ? "btn-outline-primary"
        : "btn-primary";
    let btn = Field.quick("button", `btn ${button_color} mover ${className}`);
    btn.id = `${className}-${this.idx}`;
    // what should the button do on click?
    if (action) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        action();
      });
    }

    // add icon
    let icon = Field.quick("i", `bi bi-${symbol}`);
    btn.appendChild(icon);
    return btn;
  }
}

/**
 * Class representing box to view and edit an input field when editing a schema.
 * @extends MovingField
 * @property {String} title Title of the box (title of the field, with asterisk if required).
 * @property {Boolean} repeatable Whether the field is repeatable.
 * @property {HTMLElement} div Box containing the title, example and buttons.
 * @property {HTMLElement} body Example input field, showing what the field looks like.
 * @property {bootstrap.Modal} parent_modal If the field is inside a composite field, the composite field's editor modal.
 * @property {HTMLButtonElement} rem Button used to remove the field.
 * @property {HTMLButtonElement} copy Button to duplicate the field.
 * @property {HTMLButtonElement} edit Button to edit the field.
 * @property {ComplexField} schema The schema (or mini-schema of composite field) to which the field belongs.
 * @property {HTMLButtonElement} below Button under the field used to add a new field under it. It moves along with the field.
 */
class MovingViewer extends MovingField {
  /**
   * Create a box to show and allow editing / placement / removal / duplication of a field.
   * @class
   * @param {InputField} form Field to be edited.
   * @param {ComplexField} schema Schema or mini-schema of a composite field to which the field belongs.
   */
  constructor(form, schema) {
    super(form.id);
    this.title = form.required ? form.title + "*" : form.title;
    this.repeatable = form.repeatable;
    this.help_text =
      form.constructor.name == "ObjectInput" && form.help ? form.help : "";

    // div element
    this.div = Field.quick("div", "card border-primary viewer");
    this.div.id = form.id;
    this.body = form.viewer_input();
    // Modal called for editing the field
    let modal_id = `mod-${form.id}-${form.schema_name}-${form.schema_status}`;
    let modal = bootstrap.Modal.getOrCreateInstance(
      document.getElementById(modal_id)
    );
    if (form.schema_status.startsWith("object")) {
      this.parent_modal = bootstrap.Modal.getOrCreateInstance(
        document.getElementById(schema.card_id)
      );
    }

    // more buttons
    this.rem = this.add_btn("rem", "trash", () => this.remove());
    this.copy = this.add_btn("copy", "front", () => this.duplicate(form));
    this.edit = this.add_btn("edit", "pencil", () => {
      if (this.parent_modal) {
        this.parent_modal.toggle();
      }
      modal.toggle();
    });
    // aesthetics when a field has just been duplicated
    if (form.is_duplicate) {
      this.copy.setAttribute("disabled", "");
      // this.edit.classList.replace('btn-outline-primary', 'btn-primary');
      this.edit.classList.add("shadow");
    }

    // bring everything together
    this.assemble();
    this.schema = schema;
  }

  /**
   * Create a duplicate of a field with empty ID.
   * Until the duplicate has a new ID, the (mini-)schema cannot be saved or published.
   * The duplicate itself cannot be copied (the button is disabled) and the "edit" button is highlighted.
   * @param {InputField} form Field to duplicate / copy / clone.
   */
  duplicate(form) {
    // copy of the clone
    const clone = new form.constructor(
      this.schema.initial_name,
      form.schema_status
    );

    // keep track of how many copies have been made, for temp-ID purposes
    if (form.copies) {
      form.copies += 1;
    } else {
      form.copies = 1;
    }

    // Transfer values of the original field to the copy
    clone.id = `${form.id}-copy${form.copies}`;
    clone.title = form.title;
    clone.is_duplicate = true;
    clone.required = form.required;
    clone.repeatable = form.repeatable;
    clone.values = { ...form.values }; // new version of 'values'
    clone.type = form.type;
    clone.default = form.default;
    clone.viewer_subtitle = form.viewer_subtitle;
    clone.mode = "mod";
    // Create the form and the modal corresponding to the clone field
    clone.create_form();
    clone.create_modal(this.schema);

    // Transfer the mini-schema if the field is composite
    if (form.constructor.name == "ObjectInput") {
      clone.editor.field_ids = [...form.editor.field_ids];
      clone.editor.fields = { ...form.editor.fields };
      clone.editor.field_ids.forEach((field_id, idx) => {
        clone.editor.new_field_idx = idx;
        clone.editor.view_field(clone.editor.fields[field_id]);
      });
    }

    // Add the cloned field to the (mini-)schema it belongs to
    this.schema.new_field_idx = this.schema.field_ids.indexOf(form.id) + 1;
    this.schema.add_field(clone);
  }

  /**
   * Construct and fill the HTML Element.
   */
  assemble() {
    let header = Field.quick("div", "card-header mover-header");
    let header_title = document.createElement("h5");
    header_title.innerHTML = this.title;

    // add symbol to indicate that a field is repeatable
    if (this.repeatable) {
      header_title.appendChild(Field.quick("i", "bi bi-front px-2"));
    }

    // add buttons in order
    let header_buttons = Field.quick("div", "btn-list");
    for (let button of [this.up, this.down, this.copy, this.edit, this.rem]) {
      header_buttons.appendChild(button);
    }
    // append HTML Elements to their parents
    header.appendChild(header_title);
    header.appendChild(header_buttons);

    let body = Field.quick("div", "card-body");
    body.appendChild(this.body);
    if (this.help_text) {
      let description = Field.quick("p", "form-text mt-0 mb-1", this.help_text);
      description.id = "help-composite";
      body.insertBefore(description, this.body);
      console.log(description);
    }

    this.div.appendChild(header);
    this.div.appendChild(body);
  }

  /**
   * Move the viewer down one slot.
   * This method is called when the 'down' button is clicked on,
   * which is disabled if this is the last viewer in the sequence of viewers.
   */
  move_down() {
    let form_index = this.schema.field_ids.indexOf(this.idx); // index of the field among other fields
    let sibling = this.below.nextSibling; // element under the bottom button
    let sibling_button = sibling.nextSibling; // button under the bottom button

    // first, move the field and its button
    this.div.parentElement.insertBefore(sibling, this.div);
    this.div.parentElement.insertBefore(sibling_button, this.div);

    // if the other div went to the first place
    if (form_index == 0) {
      sibling.querySelector(".up").setAttribute("disabled", "");
      this.up.removeAttribute("disabled");
    }

    // if this div became last
    if (form_index + 2 == this.schema.field_ids.length) {
      sibling.querySelector(".down").removeAttribute("disabled");
      this.down.setAttribute("disabled", "");
    }

    // move the field down in the schema
    this.schema.field_ids.splice(form_index, 1);
    this.schema.field_ids.splice(form_index + 1, 0, this.idx);
  }

  /**
   * Move the viewer up one slot.
   * This method is called when the 'up' button is clicked on,
   * which is disabled if this is the first viewer in the sequence of viewers.
   */
  move_up() {
    let form_index = this.schema.field_ids.indexOf(this.idx); // index of the field among other fields
    let sibling = this.div.previousSibling.previousSibling;

    // move the div and its button upwards
    this.div.parentElement.insertBefore(this.div, sibling);
    this.div.parentElement.insertBefore(this.below, sibling);

    // if this div went to first place
    if (form_index == 1) {
      this.up.setAttribute("disabled", "");
      sibling.querySelector(".up").removeAttribute("disabled");
    }

    // if this div was the last one
    if (form_index + 1 == this.schema.field_ids.length) {
      this.down.removeAttribute("disabled");
      sibling.querySelector(".down").setAttribute("disabled", "");
    }

    // move the field up in the schema
    this.schema.field_ids.splice(form_index, 1);
    this.schema.field_ids.splice(form_index - 1, 0, this.idx);
  }

  /**
   * Remove the viewer (and the field linked to it).
   * This method is called when the 'rem' button is clicked on, but nothing really happens unless the
   * confirmation modal triggered by it is accepted.
   */
  remove() {
    // if the field belongs to a composite field, hide its editing modal
    if (this.parent_modal) {
      this.parent_modal.toggle();
    }

    // Ask for confirmation
    Modal.ask_confirmation(
      "Deleted fields cannot be recovered.",
      () => {
        let form_index = this.schema.field_ids.indexOf(this.idx); // index of the field among other fields

        if (this.schema.field_ids.length > 1) {
          // if this is the last field
          if (this.idx == this.schema.field_ids.length - 1) {
            this.div.previousSibling.previousSibling
              .querySelector(".down")
              .setAttribute("disabled", "");
          }
          // if this is the first field
          if (this.idx == 0) {
            this.below.nextSibling
              .querySelector(".up")
              .setAttribute("disabled", "");
          }
        }

        // remove the box and buttons
        this.below.remove();
        this.div.remove();

        // remove the field from the schema
        this.schema.field_ids.splice(form_index, 1);
        delete this.schema.fields[this.idx];

        // update the schema editor
        this.schema.toggle_saving();

        // if the field belongs to a composite field, show its editing modal
        if (this.parent_modal) {
          if (
            !document
              .querySelector(`.modal#${this.schema.card_id}`)
              .classList.contains("show")
          ) {
            this.parent_modal.toggle();
          }
        }
      },
      () => {
        // cancel if the choice is not confirmed
        // (show the composite field again if relevant)
        if (this.parent_modal) {
          if (
            !document
              .querySelector(`.modal#${this.schema.card_id}`)
              .classList.contains("show")
          ) {
            this.parent_modal.toggle();
          }
        }
      }
    );
  }
}

/**
 * Class representing a moving input field to design options in a dropdown, checkbox or radio field.
 * @extends MovingField
 * @property {HTMLElement} div Div containing the input field and the buttons.
 * @property {HTMLElement} sub_div Div that contains the input field only.
 * @property {HTMLElement} label Label for the input ("Select option").
 * @property {HTMLElement} input_tag Input field
 * @property {String} [value] The value of the input field, or 'false' if it doesn't exist.
 * @property {HTMLButtonElement} rem Button used to remove the field.
 */
class MovingChoice extends MovingField {
  /**
   * Initiate a moving field in which to define an option for a dropdown, checkbox or radio.
   * @class
   * @param {String} label_text Text for the label of the input (e.g. "Select option").
   * @param {Number} idx Index of this field as it gets created.
   * @param {String} [value=false] Value of the input field, or 'false' if it doesn't exist.
   */
  constructor(label_text, idx, value = false) {
    super(idx);
    // set up HTMLElement
    this.div = Field.quick("div", "blocked");
    this.div.id = `block-${idx}`;
    this.value = value;

    // set up sub elements
    this.sub_div = Field.quick("div", "form-field");
    this.label = Field.labeller(label_text, `mover-${idx}`);
    this.input_tag = this.add_input();
    this.rem = this.add_btn("rem", "trash", () => this.remove());

    // Bring everything together
    this.assemble();
  }

  /**
   * Bring everything together (append the sub elements to the main HTML Element) in the right order.
   */
  assemble() {
    this.sub_div.appendChild(this.input_tag); // input field
    this.sub_div.appendChild(this.up); // button to move upwards
    this.sub_div.appendChild(this.down); // button to move downwards
    this.sub_div.appendChild(this.rem); // button to remove the field
    this.div.appendChild(this.label); // label for the input field
    this.div.appendChild(this.sub_div); // div with input field and buttons
  }

  /**
   * Create an input field for a new option.
   * @returns {HTMLElement} Input field to define the value of the option.
   */
  add_input() {
    let input_tag = Field.quick("input", "form-control mover");
    input_tag.id = `mover-${this.idx}`;
    input_tag.name = `mover-${this.idx}`;
    input_tag.setAttribute("required", ""); // it must be required (or removed if it won't be filled)

    // if a value exists, fill it in
    if (this.value) {
      input_tag.value = this.value;
    }
    return input_tag;
  }

  /**
   * Move the option down one slot.
   * This method is called when the 'down' button is clicked on,
   * which is disabled if this is the last option in the sequence.
   */
  move_down() {
    let sibling = this.div.nextSibling; // choice under this one
    // move the sibling up = move this down
    this.div.parentElement.insertBefore(sibling, this.div);

    // class "blocked" is the class of this kind of divs
    // if the other div went to first place
    if (sibling.previousSibling.className !== "blocked") {
      sibling.querySelector(".up").setAttribute("disabled", "");
      this.up.removeAttribute("disabled");
    }

    // if this dev went to the last place
    if (this.div.nextSibling.className !== "blocked") {
      sibling.querySelector(".down").removeAttribute("disabled");
      this.down.setAttribute("disabled", "");
    }
  }

  /**
   * Move the option up one slot.
   * This method is called when the 'up' button is clicked on,
   * which is disabled if this is the first option in the sequence.
   */
  move_up() {
    let sibling = this.div.previousSibling; // choice on top of this one

    // move this upwards
    this.div.parentElement.insertBefore(this.div, sibling);

    // class "blocked" is the class of this kind of divs
    // if this div went to first place
    if (this.div.previousSibling.className !== "blocked") {
      this.up.setAttribute("disabled", "");
      sibling.querySelector(".up").removeAttribute("disabled");
    }

    // if we were in the last place
    if (sibling.nextSibling.className !== "blocked") {
      this.down.removeAttribute("disabled");
      sibling.querySelector(".down").setAttribute("disabled", "");
    }
  }

  /**
   * Remove a Moving Choice. This is a static method because it is also called from outside
   * when resetting the form it belongs to.
   * @static
   * @param {HTMLDivElement} div A DIV element from a MovingChoice to be removed from the form.
   */
  static remove_div(div) {
    // if this is the last option
    if (!div.nextSibling.classList.contains("blocked")) {
      div.previousSibling.querySelector(".down").setAttribute("disabled", "");
    }
    // if this was the first option
    if (!div.previousSibling.classList.contains("blocked")) {
      div.nextSibling.querySelector(".up").setAttribute("disabled", "");
    }

    // check how many children there are
    let existing_children = div.parentElement.querySelectorAll(".blocked");
    // if there are only up to three children (they will be one fewer in a moment)
    if (existing_children.length <= 3) {
      // disable their 'remove' buttons
      existing_children.forEach((child) => {
        child.querySelector(".rem").setAttribute("disabled", "");
      });
    }

    // remove this element
    div.remove();
  }

  /**
   * Remove this option.
   * This method is called when the 'rem' button is clicked on,
   * which is disabled if there are only two options.
   */
  remove() {
    MovingChoice.remove_div(this.div);
  }
}

/**
 * Class for forms used when editing a schema or field.
 *
 * @property {HTMLFormElement} form The 'form' element itself, with BS5 validation.
 * @property {Number[]} option_indices List of indices of moving fields (if relevant).
 * @property {HTMLHRElement} divider An 'hr' element to split the form content from the submission buttons.
 * @property {HTMLDivElement} rowsub A 'div' element with class 'row' that contains the submission buttons.
 * @property {HTMLDivElement} switches A 'div' element with switches (e.g. 'required', 'repeatable').
 */
class BasicForm {
  /**
   * Initialize a standard form.
   * @class
   * @param {String} id ID of the field or schema this form is used to edit.
   */
  constructor(id) {
    // create the form itself
    this.form = Field.quick("form", "m-3 needs-validation");
    this.form.id = `form-${id}`;
    this.form.setAttribute("novalidate", "");

    // if this form edits a multiple-choice field, we have to keep track of the moving input fields
    // this array registers the index of an input field when it has been added (but it doesn't care if it has been removed)
    // when a new input field must be added, we make sure that the index is larger than any previous index
    this.option_indices = [];

    // create and append the divider
    this.divider = document.createElement("hr");
    this.form.appendChild(this.divider);

    // create and append the row for the submission buttons
    this.rowsub = Field.quick("div", "row justify-content-between");
    this.rowsub.id = "submitters";
    this.form.appendChild(this.rowsub);
  }

  /**
   * Create a text input element for the form and insert it before the divider or, if they exist, the switches.
   * @param {String} label_text Text for the label of the input field.
   * @param {String} input_id ID of the input field.
   * @param {String|Boolean} [description=false] A description for the input field.
   * @param {String} [placeholder="Some text"] A placeholder for the input field.
   * @param {String|Boolean} [value=false] Value to fill into the input field, if it exists.
   * @param {String} [validation_message="This field is compulsory"] Message to show when the input field does not fulfill the validation criteria on form submission.
   * @param {String} [pattenr=".*"] A regular expression that the (text) input field must match to be accepted on submission.
   * @param {Boolean} [required=true] Whether the input field should be required.
   */
  add_input(
    label_text,
    input_id,
    {
      description = false,
      placeholder = "Some text",
      value = false,
      validation_message = "This field is compulsory",
      pattern = ".*",
      required = true,
      as_textarea = false,
    } = {}
  ) {
    // Create the input tag
    let input_tag = Field.quick(
      as_textarea ? "textarea" : "input",
      "form-control"
    );
    input_tag.id = input_id;
    input_tag.name = input_id;
    if (!as_textarea) {
      input_tag.type = "text";
      input_tag.pattern = pattern;
    }
    input_tag.placeholder = placeholder;

    if (required) {
      input_tag.setAttribute("required", "");
    }

    if (value) {
      input_tag.value = value;
    }

    let label = Field.labeller(label_text, input_id);

    let validator = Field.quick("div", "invalid-feedback", validation_message);

    // Assemble input, label, description and validation message
    let input_div = Field.quick("div", "mb-3 form-container");
    input_div.id = "div-" + input_id;
    input_div.appendChild(label);
    input_div.appendChild(input_tag);

    if (description) {
      let input_desc = Field.quick("div", "form-text mt-0 mb-1", description);
      input_desc.id = "help-" + input_id;
      input_tag.setAttribute("aria-describedby", `help-${input_id}`);
      input_div.appendChild(input_desc);
    }

    input_div.appendChild(validator);

    // Append the input to the form, before the switches if they exist, or before the divider
    if (this.switches) {
      this.form.insertBefore(input_div, this.switches);
    } else {
      this.form.insertBefore(input_div, this.divider);
    }
  }

  /**
   * Create and append a dropdown before the divider.
   * @param {String} label_text Text for the label of the dropdown.
   * @param {String} select_id ID for the dropdown.
   * @param {String[]} options Options for the dropdown.
   * @param {String|Boolean} [selected=false] Selected option, if any.
   */
  add_select(label_text, select_id, options, selected = false) {
    // Create a select div
    let select = Field.quick("select", "form-select");
    select.ariaLabel = "Select typing input type";
    select.id = select_id;
    select.name = select_id;
    // by default, the first option is "selected"
    if (!selected) {
      selected = options[0];
    }

    // fill in the options
    options.forEach((option) => {
      let new_option = document.createElement("option");
      new_option.value = option;
      new_option.innerHTML = option;
      if (option == selected) {
        new_option.setAttribute("selected", "");
      }
      select.appendChild(new_option);
    });

    // assemble the input
    let input_div = Field.quick("div", "mb-3 form-container");
    input_div.appendChild(Field.labeller(label_text, select_id));
    input_div.appendChild(select);

    // append the input to the form, right before the divider
    this.form.insertBefore(input_div, this.divider);
  }

  /**
   * Create and append a moving input field (when creating options for multiple-choice fields).
   *
   * @param {String} label_text Text for the label of the input field (e.g. "Select option").
   * @param {Number} idx Index of the mover in order of creation.
   * @param {String|Boolean} value Value of the input field in the mover, if it exists.
   * @returns {MovingChoice} Moving input field.
   */
  add_mover(label_text, idx, value = false) {
    let input = new MovingChoice(label_text, idx, value).div;

    // if there aren't more than two fields yet, don't allow removal
    if (idx < 2) {
      input.querySelector(".rem").setAttribute("disabled", "");
    }
    // register that a new mover has been added
    this.option_indices.push(idx);
    return input;
  }

  /**
   * Initialize a series of moving choice fields, when first generating a form
   * for a MultipleInput field.
   * @param {String} label_text Text for the label of the input fields (e.g. "Select option").
   * @param {Array<String|Number>} [starting_values] Initial values for the moving fields.
   */
  add_moving_options(label_text, starting_values = []) {
    let options = starting_values;
    let has_values = options.length > 0;
    // if no options are provided, start with two
    if (!has_values) {
      options = [0, 1];
    }

    // go through each option and create a mover
    // with its value if provided
    for (let i in options) {
      let input = this.add_mover(
        label_text,
        i,
        has_values ? options[i] : false
      );

      // re-enable removing if there are more than two options
      if (options.length > 2) {
        input.querySelector(".rem").removeAttribute("disabled");
      }

      // disable the 'up' button of the first mover
      if (i == 0) {
        input.querySelector(".up").setAttribute("disabled", "");
      }
      // disable the 'down' button of the last mover
      if (i == options.length - 1) {
        input.querySelector(".down").setAttribute("disabled", "");
      }

      // add the field to the form, before the divider
      this.form.insertBefore(input, this.divider);
    }

    // create and add a button to add more inputs
    let plus_div = Field.quick("div", "d-grid gap-2 mover mt-2");
    let plus = Field.quick("button", "btn btn-primary btn-sm", "Add option");
    plus.type = "button";
    plus.id = "add-mover";
    // define the behavior of the button when clicking
    plus.addEventListener("click", (e) => {
      e.preventDefault();
      // check the maximum index of created fields
      let current_max = Math.max(...this.option_indices);

      // add a new mover with a higher index
      let new_input = this.add_mover(label_text, current_max + 1);

      // disable its 'down' button
      new_input.querySelector(".down").setAttribute("disabled", "");

      // add it to the form
      this.form.insertBefore(new_input, plus.parentNode);

      // re-enable the 'down' button of the field before it
      new_input.previousSibling
        .querySelector(".down")
        .removeAttribute("disabled");

      // check how many fields there are
      let existing_children = this.form.querySelectorAll(".blocked");
      // if now there are three
      if (existing_children.length == 3) {
        existing_children.forEach((child) => {
          child.querySelector(".rem").removeAttribute("disabled");
        });
      }
    });
    plus_div.appendChild(plus);
    this.form.insertBefore(plus_div, this.divider);
  }

  /**
   * Create and append a DIV element that contains switches to define boolean values of an InputField.
   * @param {String} id ID of the field to which the form belongs.
   * @param {String[]} switchnames Names of the switches to add. Possible values inside are 'required', 'repeatable' and 'dropdown'.
   * @param {Boolean} [required=false] Default value of the 'required' switch, i.e. whether the InputField is required.
   * @param {Boolean} [repeatable=false] Default value of the 'repeatable' switch, i.e. whether the InputField is repeatable.
   * @param {Boolean} [dropdown=false] Default value of the 'dropdown' switch, i.e. whether the MultipleInput will be rendered as a dropdown.
   */
  add_switches(
    id,
    switchnames = ["required", "repeatable"],
    { required = false, repeatable = false, dropdown = false } = {}
  ) {
    // create the div for the switches
    this.switches = Field.quick("div", "col-3 mt-2");
    this.switches.id = "switches-div";

    // set up the switches
    let subdiv = Field.quick("div", "form-check form-switch form-check-inline");

    // possible switches with their ids, text and values
    let switches = {
      required: { id: "required", text: "Required", value: required },
      repeatable: { id: "repeatable", text: "Repeatable", value: repeatable },
      dropdown: { id: "dropdown", text: "As dropdown", value: dropdown },
    };

    // only create the switches requested in switchnames, in that order
    for (let sname of switchnames) {
      // retrieve attributes
      let sw = switches[sname];

      // create the label
      let label = Field.quick("label", "form-check-label", sw.text);
      label.id = `label-${id}-${sw.id}`;
      label.setAttribute("for", `${sw.id}-${id}`);

      // create the input itself
      let input = Field.quick("input", "form-check-input");
      input.type = "checkbox";
      input.role = "switch";
      input.id = `${id}-${sw.id}`;
      if (sw.value) {
        input.setAttribute("checked", "");
      }

      // assemble
      subdiv.appendChild(label);
      subdiv.appendChild(input);
    }

    // attach to form
    this.switches.appendChild(subdiv);
    this.form.insertBefore(this.switches, this.divider);
  }

  /**
   * Create and append a button for submission.
   * @param {String} text Text in the action button.
   * @param {String} id ID for the button.
   * @param {String} color Color class for the button, e.g. 'success', 'danger'...
   */
  add_action_button(text, id = "draft", color = "success") {
    let div = Field.quick("div", "col-auto mt-3");
    let button = Field.quick("button", "btn btn-" + color, text);
    button.id = id;
    button.type = "submit";
    div.appendChild(button);
    this.rowsub.appendChild(div);
  }

  /**
   * Add an action on submission of the form, depending on the button that is clicked.
   * @param {String} id ID of the button that will trigger this action.
   * @param {Function} action Action to execute when clicking on the button.
   */
  add_submit_action(id, action) {
    this.form
      .querySelector("[type='submit']#" + id)
      .addEventListener("click", action);
  }

  /**
   * Reset the form, uncheck boxes, remove the 'was-validated' class.
   */
  reset() {
    this.form.reset();
    let checkboxes = this.form.querySelectorAll('[type="checkbox"]');
    for (let checkbox of checkboxes) {
      checkbox.removeAttribute("checked");
    }
    let dropdowns = this.form.querySelectorAll("select");
    if (dropdowns.length > 0) {
      let default_dropdown = [...dropdowns].filter((x) =>
        x.id.endsWith("default")
      )[0];
      if (default_dropdown != undefined) {
        default_dropdown.querySelectorAll("option").forEach((x) => x.remove());
      }
    }
    this.form.classList.remove("was-validated");
  }
}

/**
 * Class for forms used when editing a schema (draft).
 * It includes hidden inputs that are not included in its parent class.
 * @extends BasicForm
 */
class SchemaDraftForm extends BasicForm {
  /**
   * Initialize a form to edit a schema.
   * @class
   * @param {Schema} schema A schema to edit via this form.
   */
  constructor(schema) {
    // initialize a BasicForm
    super(`${schema.card_id}-${schema.data_status}`);

    // add action and method attributes for submission
    this.form.setAttribute("action", schema.urls.new);
    this.form.setAttribute("method", "POST");

    // hidden inputs to add for submission
    const inputs = {
      realm: realm, // realm that the schema belongs to
      current_version: schema.version, // version number
      raw_schema: "", // encoded and stringified collection of fields
      with_status: schema.status, // status
      parent: schema.parent ? schema.parent : "", // parent, if it exists
    };
    for (let i of Object.entries(inputs)) {
      this.add_hidden_field(i[0], i[1]);
    }
  }

  /**
   * Create a new hidden field and attach to the form.
   * @param {String} name Value of the 'name' attribute of the form input.
   * @param {String} value Value of the form input.
   */
  add_hidden_field(name, value) {
    const hidden_input = document.createElement("input");
    hidden_input.type = "hidden";
    hidden_input.name = name;
    hidden_input.value = value;
    this.form.appendChild(hidden_input);
  }

  /**
   * Update an existing field of the form with a new value.
   * @param {String} name Value of the 'name' attribute of the form input.
   * @param {String} value Value of the form input.
   */
  update_field(name, value) {
    this.form.querySelector(`input[name="${name}"]`).value = value;
  }
}

/**
 * Class to create a standard BS5 Modal, typically containing a form to edit a Schema or InputField.
 * @property {String} id ID of the modal itself.
 * @property {String} header_title Text of the title in the header of the modal.
 */
class Modal {
  /**
   * Initialize a modal.
   * @class
   * @param {String} modal_id ID of the modal.
   * @param {String} header_title Text of the title in the header of the modal.
   */
  constructor(modal_id, header_title) {
    this.id = modal_id;
    this.header_title = header_title;
  }

  /**
   * Create the header for the modal.
   * @returns {HTMLDivElement} The header for the modal.
   */
  create_header() {
    let modal_header = Field.quick("div", "modal-header");

    let modal_title = Field.quick(
      "h5",
      "modal-title",
      this.header_title,
      `${this.id}-title`
    );

    // include the dismiss button
    let modal_close = Field.quick("button", "btn-close");
    modal_close.setAttribute("data-bs-dismiss", "modal");
    modal_close.ariaLabel = "Close";
    modal_header.appendChild(modal_title);
    modal_header.appendChild(modal_close);

    return modal_header;
  }

  /**
   * Create the body of the modal.
   * @param {HTMLElement[]} body_contents Elements to append to the body of the modal, e.g. a form.
   * @returns {HTMLDivElement} The body of the modal.
   */
  create_body(body_contents) {
    let modal_body = Field.quick("div", "modal-body");
    body_contents.forEach((x) => modal_body.appendChild(x));

    return modal_body;
  }

  /**
   * Create the footer of the modal
   * @returns {HTMLDivElement} Footer of the modal.
   */
  create_footer() {
    let modal_footer = Field.quick("div", "modal-footer");

    // add a cancelling button
    let footer_close = Field.quick("button", "btn btn-secondary", "Cancel");
    footer_close.type = "button";
    footer_close.setAttribute("data-bs-dismiss", "modal");

    modal_footer.appendChild(footer_close);

    return modal_footer;
  }

  /**
   * Assemble the modal and attach it to the "body" element.
   * @param {HTMLElement[]} body_contents Elements to add to the body of the modal, e.g. a form.
   * @param {String} [size=null] Size of the modal, e.g. 'sm', 'md'...
   */
  create_modal(body_contents, size = null) {
    // Initialize the modal itself
    let modal = Field.quick("div", "modal");
    modal.id = this.id;
    modal.tabIndex = "-1";
    modal.role = "dialog";

    // Create the divs that go inside the modal
    let modal_dialog = Field.quick(
      "div",
      size == null ? "modal-dialog" : `modal-dialog modal-${size}`
    );

    let modal_content = Field.quick("div", "modal-content");

    let modal_header = this.create_header();

    let modal_body = this.create_body(body_contents);

    let modal_footer = this.create_footer();

    // Append different elements to each other
    modal_content.appendChild(modal_header);
    modal_content.appendChild(modal_body);
    modal_content.appendChild(modal_footer);

    modal_dialog.appendChild(modal_content);
    modal.appendChild(modal_dialog);

    // Attach to the body of the document
    document.querySelector("body").appendChild(modal);
  }

  /**
   * Fill in the existing confirmation modal and show it to obtain a simple yes/no answer
   * to a confirmation question (e.g. Are you sure you want to delete this field?).
   * This does not apply to modals created with the Modal class, but refers to a modal.
   * @static
   * @param {String} body Descriptive text to append to the modal (what are the consequences of accepting this?).
   * @param {Function} action What to do after a positive answer.
   * @param {Function} dismiss What to do after dismissal of the modal (if anything).
   */
  static ask_confirmation(body, action, dismiss) {
    // capture the modal
    let conf_modal = document.querySelector("div.modal#confirmation-dialog");
    let modal = bootstrap.Modal.getOrCreateInstance(conf_modal);

    // apply the provided text
    conf_modal.querySelector("p#confirmation-text").innerHTML = body;

    // capture action button and assign action
    let action_btn = conf_modal.querySelector("button#action");
    action_btn.type = "button";
    action_btn.addEventListener("click", () => {
      action();
      modal.hide();
    });

    // capture dismiss button and attach action
    conf_modal
      .querySelector('button[data-bs-dismiss="modal"]')
      .addEventListener("click", () => {
        if (dismiss != undefined) {
          dismiss();
        } else {
          return;
        }
      });
    // show the modal
    modal.show();
  }

  /**
   * Fill in the existing confirmation modal and its form and show it to obtain a simple yes/no answer
   * to a confirmation question (e.g. Are you sure you want to discard this draft?).
   * This does not apply to modals created with the Modal class, but refers to a modal.
   * The confirmation button becomes now a submission button for the form contained in the modal.
   * @static
   * @param {String} body Descriptive text to append to the modal (what are the consequences of accepting this?).
   * @param {String} url URL to post the contents of the hidden form to.
   * @param {Object<String,String>} form_data Names and values of the hidden fields to add to the form.
   * @param {Function} extra_Action Something extra to do on submission, if relevant.
   */
  static submit_confirmation(body, url, form_data, extra_action) {
    // capture the modal
    let conf_modal = document.querySelector("div.modal#confirmation-dialog");
    conf_modal.querySelector("button#action").type = "submit";
    let modal = bootstrap.Modal.getOrCreateInstance(conf_modal);

    // fill in the explanatory text
    conf_modal.querySelector("p#confirmation-text").innerHTML = body;

    // capture and fill in the form with hidden fields
    let form = conf_modal.querySelector("form");
    form.setAttribute("method", "POST");
    form.setAttribute("action", url);
    const modal_body = form.querySelector("div.modal-body");
    for (let item of Object.entries(form_data)) {
      let hidden_input = document.createElement("input");
      hidden_input.type = "hidden";
      hidden_input.name = item[0];
      hidden_input.value = item[1];
      modal_body.appendChild(hidden_input);
    }
    // assign extra action if it exists
    if (extra_action != undefined) {
      form.addEventListener("submit", () => {
        extra_action();
      });
    }

    // show modal
    modal.show();
  }

  /**
   * Update the values of the hidden inputs in the form of the confirmation modal right before submission.
   * @param {Object<String,String>} form_data Value of name and value attributes of the fields in the form.
   */
  static fill_confirmation_form(form_data) {
    const form = document.querySelector(
      "div.modal#confirmation-dialog div.modal-body"
    );
    Object.entries(form_data).forEach((item) => {
      form.querySelector(`input[name="${item[0]}"]`).value = item[1];
    });
  }
}

/**
 * Class to create a standard BS5 Accordion Item, in which the information of a given schema
 * and all its versions will be displayed.
 * @property {String} id The ID of the accordion item we are creating.
 * @property {String} accordion The ID of the accordion itself.
 * @property {String} header_title The title of the accordion item, i.e. the name of the schema it shows.
 * @property {HTMLDivElement} div The accordion item itself.
 * @property {HTMLDivElement} card_body The body of the accordion item, where the tabs will be displayed.
 * @property {Boolean} new Whether the item corresponds to the "new schema" editor.
 */
class AccordionItem {
  /**
   * Initialize a new accordion item to host a schema and all its versions.
   * @class
   * @param {String} id ID of the accordion item.
   * @param {String} header_title Title of the accordion item, i.e. the name of the schema it shows.
   * @param {String} accordion ID of the accordion itself.
   * @param {Boolean} is_new Whether the item corresponds to the "new schema" editor.
   */
  constructor(id, header_title, accordion, is_new = false) {
    this.id = id;
    this.parent = accordion;
    this.header_title = header_title;
    this.div = Field.quick("div", "accordion-item");
    this.new = is_new;
    this.create();
  }

  /**
   * Assemble the parts of the accordion
   */
  create() {
    // Create the header
    let header = Field.quick("div", "accordion-header");
    header.id = this.id + "-header";
    let header_button = Field.quick(
      "button",
      this.new ? "btn btn-primary m-2" : "accordion-button h4",
      this.header_title
    );
    header_button.type = "button";
    header_button.setAttribute("data-bs-toggle", "collapse");
    header_button.setAttribute("data-bs-target", "#" + this.id);
    header_button.ariaControls = this.id;
    header.appendChild(header_button);

    // Create the body
    let body = Field.quick("div", "accordion-collapse collapse");
    body.id = this.id;
    body.setAttribute("aria-labelledby", this.id + "-header");
    body.setAttribute("data-bs-parent", "#" + this.parent);
    this.card_body = Field.quick("div", "accordion-body");
    body.appendChild(this.card_body);

    // Bring everything together
    this.div.appendChild(header);
    this.div.appendChild(body);
  }

  /**
   * Append a new element to the accordion item.
   * @param {HTMLElement} element An element to append to the accordion item, e.g. a new tab.
   * @param {Number} [i=null] Index of the element.
   */
  append(element, i = null) {
    let elements = this.card_body.childNodes;
    // If `i` is not specified or it's too large
    if (i == null || i >= elements.childNodes.length - 1) {
      // add the element to the end of the accordion
      this.card_body.appendChild(element);
    } else {
      // add the element in the requested position
      this.card_body.insertBefore(element, elements[i + 1]);
    }
  }
}

/**
 * Class to create a navigation bar with pills or tabs.
 * This is used to display the different versions of a schema, with tabs that have badges,
 * and to switch between views and editors within a version of a schema.
 * @property {HTMLUListElement} nav_bar A list of tabs for navigation.
 * @property {HTMLDivElement} tab_content The content of the tabs
 * @property {String} id ID of the instance, used for the IDs of its DOM components.
 */
class NavBar {
  /**
   * Initialize a navigation bar to host versions of a schema or view/editors of a version.
   * @class
   * @param {String} id ID of the NavBar instance, used for the IDs of the navigation list and contents.
   * @param {String[]} extra_classes Names of classes to be added to the list of navigation bar, e.g. 'justify-content-end' and 'nav-pills'.
   */
  constructor(id, extra_classes = []) {
    // create or retrieve a navigation bar and content
    this.nav_bar = document.getElementById("nav-tab-" + id);
    if (this.nav_bar == null) {
      this.nav_bar = Field.quick("ul", "nav");
      this.nav_bar.role = "tablist";
      this.nav_bar.id = "nav-tab-" + id;
      this.tab_content = Field.quick("div", "tab-content");
    } else {
      this.tab_content = this.nav_bar.nextSibling;
    }
    this.id = id;
    for (let extra_class of extra_classes) {
      // pills would be called with extra_classes = ['justify-content-end', 'nav-pills']
      this.nav_bar.classList.add(extra_class);
    }
  }

  /**
   * Add a new item to the navigation bar and content.
   * @param {String} item_id Identifier of the item within the navigation bar.
   * @param {String|HTMLElement} button_text Content of the button that activates the tab.
   * @param {Boolean} [active=false] Whether the tab should be focused on.
   * @param {Number} [position=-1] Index of the item. If -1, the item is added at the end.
   */
  add_item(item_id, button_text, active = false, position = -1) {
    this.add_button(item_id, button_text, active, position);
    this.add_tab(item_id, active, position);
  }

  /**
   * Remove an item from the navigation bar and content.
   * @param {String} item_id Identified of the item within the navigation bar.
   */
  remove_item(item_id) {
    document.getElementById(`${item_id}-tab-${this.id}`).parentElement.remove();
    document.getElementById(`${item_id}-pane-${this.id}`).remove();
  }

  /**
   * Add a button to the list in the navigation bar, with the function of activating a corresponding tab.
   * @param {String} item_id Identifier of the item within the navigation bar.
   * @param {String|HTMLElement} button_text Content of the button.
   * @param {Boolean} active Whether the tab should be focused on.
   * @param {Number} [position=-1] Index of the item. If -1, the item is added at the end.
   */
  add_button(item_id, button_text, active, position = -1) {
    // create item and button
    let li = Field.quick("li", "nav-item");
    let button = document.createElement("button");

    // provide the 'active' class if relevant
    button.className = active ? "nav-link active" : "nav-link";

    // fill the contents of the button
    if (typeof button_text == "string") {
      button.innerHTML = button_text;
    } else {
      button_text.forEach((b) => button.appendChild(b));
    }
    button.id = `${item_id}-tab-${this.id}`;
    button.setAttribute("data-bs-toggle", "tab");
    button.setAttribute("data-bs-target", `#${item_id}-pane-${this.id}`);
    button.type = "button";
    button.role = "tab";
    button.setAttribute("aria-controls", `${item_id}-pane-${this.id}`);
    li.appendChild(button);

    // add the button to the navbar
    if (position != -1 && this.nav_bar.children.length > position) {
      let sibling = this.nav_bar.children[position];
      this.nav_bar.insertBefore(li, sibling);
    } else {
      this.nav_bar.appendChild(li);
    }
  }

  /**
   * Add a content tab for an item.
   * @param {String} item_id Identifier of the item among other tabs.
   * @param {Boolean} active Whether the tab should be focused on.
   * @param {Number} [position=-1] Index of the item. If -1, the item is added at the end.
   */
  add_tab(item_id, active, position = -1) {
    // Create the tab with the right classes
    let tab = Field.quick(
      "div",
      active ? "tab-pane fade show active" : "tab-pane fade"
    );
    tab.id = `${item_id}-pane-${this.id}`;
    tab.role = "tabpanel";
    tab.setAttribute("aria-labelledby", `${item_id}-tab-${this.id}`);
    tab.tabIndex = "0";

    // Assign appropriate position
    if (position != -1 && this.tab_content.children.length > position) {
      let sibling = this.tab_content.children[position];
      this.tab_content.insertBefore(tab, sibling);
    } else {
      this.tab_content.appendChild(tab);
    }
  }

  /**
   * Add some content to an existing tab.
   * @param {String} item_id Identifier of the item among other tabs.
   * @param {HTMLElement} content Element to append to the tab.
   */
  add_tab_content(item_id, content) {
    this.tab_content
      .querySelector(`#${item_id}-pane-${this.id}`)
      .appendChild(content);
  }

  /**
   * Add a button to the navigation bar that does not link to a content tab but triggers an action.
   * @param {String} text Text inside the button.
   * @param {String} color Color class, e.g. 'success', 'danger'...
   * @param {Function} action Action to trigger when the button is clicked.
   */
  add_action_button(text, color, action) {
    // Create the button
    let btn = Field.quick("button", `btn btn-outline-${color}`, text);
    let id = text.toLowerCase().replaceAll(" ", "-");
    btn.id = `${id}-${this.id}`;
    btn.type = "button";

    // Assign the action
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      action();
    });

    // Add to the navigation bar
    this.nav_bar.appendChild(btn);
  }
}
