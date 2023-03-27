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
    constructor(schema_name, data_status = 'draft') {
        // Strings for the example
        this.description = "";
        this.dummy_title = "Informative label";

        // Attributes to limit some behavior
        this.mode = 'add';
        this.is_duplicate = false;

        // Info about the field contents
        this.required = false;
        this.repeatable = false;
        this.values = {};

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
            `ID for ${this.form_type} (underlying label)`, `${this.id}-id`,
            {
                description: "Use lowercase or numbers, no spaces, no special characters other than '_'.",
                value: this.field_id, validation_message: "This field is compulsory. Use only lowercase, numbers, and '_'.",
                pattern: "[a-z0-9_]+"
            }
        );

        // add an input field to provide the title of the field
        this.form_field.add_input(
            `Label for ${this.form_type} (display name)`, `${this.id}-label`,
            {
                description: "This is what an user will see when inserting metadata.",
                value: this.title
            });
    }

    /**
     * Add the last parts of the form
     * The behavior is more or less subclass-specific, so maybe it can be cleaned up a bit.
     */
    end_form() {
        let this_class = this.constructor.name;

        // Add a field to provide a default value, if relevant
        this.add_default_field();

        // Add a space before switches and buttons
        this.form_field.form.appendChild(document.createElement('br'));

        // define whether there should be a dropdown option
        let dropdownable = this_class == 'SelectInput' | this_class == 'CheckboxInput';

        // define whether the field may be repeated
        // ObjectInput included as in_object to TEMPORARILY disable repeatable objects
        let is_object = this_class == 'ObjectInput';

        // define whether the field may be required
        let requirable = !(this_class == 'CheckboxInput' | this_class == 'ObjectInput');

        // generate the list of switches
        let switchnames = requirable ? ['required'] : [];
        let switches = requirable ? { required: this.required } : {};

        // dropdownable is mutually exclusive with repeatable
        if (dropdownable) {
            switchnames.push('dropdown');
            switches.dropdown = this.values.ui == 'dropdown';
        } else if (!is_object) {
            // only if it is NOT dropdownable and also not a composite field
            // this could be limited to simple fields, but this way we can make the composite fields repeatable easily
            // which is the way it was for a while
            switchnames.push('repeatable');
            switches.repeatable = this.repeatable;
        }
        this.form_field.add_switches(this.id, switchnames, switches);

        // define the behavior of the 'required' switch
        if (requirable) {
            let req_input = this.form_field.form.querySelector(`#${this.id}-required`);

            // if it's a simple field with a checkbox
            if (this.type == 'checkbox') {
                req_input.setAttribute('disabled', '');
            }
            req_input.addEventListener('change', () => {
                this.required = !this.required;
                this.required ? req_input.setAttribute('checked', '') : req_input.removeAttribute('checked');
            });
        }

        // define the behavior of the 'dropdown' switch
        if (dropdownable) {
            let dd_input = this.form_field.form.querySelector(`#${this.id}-dropdown`);
            dd_input.addEventListener('change', () => {
                this.values.ui = this.values.ui == 'dropdown' ? this.dropdown_alt : 'dropdown';
                this.values.ui == 'dropdown' ? dd_input.setAttribute('checked', '') : dd_input.removeAttribute('checked');
            });
        } else if (!is_object) { // define the behavior of the 'repeatable' switch
            let rep_input = this.form_field.form.querySelector(`#${this.id}-repeatable`);
            if (this.type == 'checkbox') {
                rep_input.setAttribute('disabled', '');
            }
            rep_input.addEventListener('change', () => {
                this.repeatable = !this.repeatable;
                this.repeatable ? rep_input.setAttribute('checked', '') : rep_input.removeAttribute('checked');
            });
        }

        // add a button to confirm the changes
        this.form_field.add_action_button(this.mode == 'add'
            ? `Add to ${this.schema_status.startsWith('object') ? 'object' : 'schema'}`
            : "Update",
            'add');
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
        edit_modal.create_modal([form], 'lg');

        // capture modal for manipulation
        let modal_dom = document.getElementById(modal_id);
        this.modal = bootstrap.Modal.getOrCreateInstance(modal_dom);

        // define behavior on form submission
        this.form_field.add_submit_action('add', (e) => {
            e.preventDefault();
            // BS5 validation check
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add('was-validated');
            } else {
                // create a new field of the same type with the data in the form
                let clone = this.register_fields(schema);

                // ok the form
                form.classList.remove('was-validated');

                // close the modal
                this.modal.toggle();

                // if the field is part of the composite field, re-activate the composite field's editing modal
                if (schema.constructor.name == 'ObjectEditor') {
                    let parent_modal_dom = document.getElementById(`${schema.card_id}`);
                    let parent_modal = bootstrap.Modal.getOrCreateInstance(parent_modal_dom);
                    parent_modal.toggle();
                }

                // recreate the updated (probably cleaned) form
                modal_dom.querySelector('.modal-body').appendChild(form);

                // create id for the new field
                let clone_modal_id = `${clone.mode}-${clone.id}-${clone.schema_name}-${clone.schema_status}`;

                // if the new field is completely new or has changed ID
                if (clone_modal_id != modal_id) {
                    // fill the new field's modal with its form
                    let clone_modal_dom = document.getElementById(clone_modal_id);
                    let clone_form = clone.form_field.form;
                    clone_modal_dom.querySelector('.modal-body').appendChild(clone_form);
                }
            }
        }, false);

        // the lines below are a hack to avoid a new empty form from showing up as validated
        modal_dom.addEventListener('shown.bs.modal', (e) => {
            if (this.mode == 'add') {
                form.classList.remove('was-validated');
            }
        });
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
        let new_button = Field.quick("button", "btn btn-primary choice-button", this.button_title);
        new_button.setAttribute("data-bs-toggle", "modal");
        new_button.setAttribute("data-bs-target", '#' + modal_id);

        // append everything to a div
        let new_form = Field.quick("div", "shadow border rounded p-4 mb-3");
        new_form.appendChild(new_button);
        new_form.appendChild(this.create_example());

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
        let new_id = data.get(`${this.id}-id`);
        // capture the 'default' value if relevant
        if (this.required) {
            this.default = data.get(`${this.id}-default`);
        }

        // if we are updating an existing field without changing the ID
        if (old_id == new_id) {
            this.title = data.get(`${this.id}-label`);
            this.recover_fields(data); // update the field
            schema.update_field(this); // update the schema
            return this;
        } else { // if we are changing IDs or creating a new field altogether
            // create a new field with the same type
            let clone = new this.constructor(schema.initial_name, this.schema_status);
            // id as it will show in the "ID" field of the form
            clone.field_id = new_id;

            // transfer the form
            clone.form_field = this.form_field;

            // register the main info
            clone.title = data.get(`${this.id}-label`);
            clone.required = this.required;
            clone.repeatable = this.repeatable;
            clone.default = this.default;
            clone.id = this.id // temporarily, to recover data

            if (this.constructor.name == 'ObjectInput') {
                // this will have to change to adapt to creating filled-schemas (attached to new ids)
                clone.editor = this.editor;
                delete this.editor;
                this.create_editor();
            }

            clone.recover_fields(data);
            // when the field is not new anymore, its id matches the field_id
            clone.id = clone.field_id;

            // bring the current form, editor and contents to their original values
            this.reset();

            // set the mode of the new field, create form and modal that hosts the form
            clone.mode = 'mod';
            clone.create_form();
            clone.create_modal(schema);

            // register new field in the schema
            if (this.mode == 'mod') {
                schema.replace_field(old_id, clone);
            } else {
                schema.add_field(clone);
            }
            return clone;
        }
    }

    /**
     * Read the form used to edit the field and register the appropriate values.
     * Implemented within each subclass, except for `ObjectInput`.
     * @param {FormData} data Contents of the editing form of the field.
     */
    recover_fields(data) {
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
        this.form_field.reset();
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
        if (data.type == 'object') {
            new_field = new ObjectInput(schema_name, data_status);
        } else if (data.type == 'select') {
            // if the type is 'select', create a multiple-value or single-value multiple choice, depending on the value of 'multiple'
            new_field = data.multiple ? new CheckboxInput(schema_name, data_status) : new SelectInput(schema_name, data_status);
        } else {
            // the other remaining option is the single field
            new_field = new TypedInput(schema_name, data_status);
        }
        // fill in the basic information not present in the FieldInfo object
        new_field.field_id = id;
        new_field.id = id;
        new_field.mode = 'mod';

        // read the FieldInfo object to retrieve and register the data
        new_field.from_json(data);
        return new_field;
    }
}

/**
 * Class representing a simple field.
 * Its `form_type` is always "text", whereas its `type` refers to one of many possible input options.
 * Its `button_title` is "Simple field" and its `description` includes the many input options.
 * @extends InputField
 * @property {Number} values.minimum For numeric inputs, the minimum possible value.
 * @property {Number} values.minimum For numeric inputs, the maximum possible value.
 */
class TypedInput extends InputField {
    /**
     * Initialize a new single field in a (mini-)schema.
     * @class
     * @param {String} schema_name Name of the schema that the field is attached to, for form identification purposes.
     * @param {String} [data_status=draft] Status of the schema version that the field is attached to, for form identification purposes.
     */
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.type = "text";
        this.values = {};
    }

    form_type = "text"; // name of the class for DOM IDs
    button_title = "Simple field"; // user-facing name
    description = "Text options: regular text, number (integer or float), date, time, datetime, e-mail, URL or single checkbox.<br>"

    /**
     * Depending on the existence of minimum or maximum for the numeric fields,
     * provide the appropriate descriptive text.
     * @returns {String} Text describing the range of a numeric field.
     */
    print_range() {
        // if we have both values
        if (this.values.minimum && this.values.maximum) {
            return `between ${this.values.minimum} and ${this.values.maximum}`;
        } else if (this.values.minimum) { // if we have the minimum only
            return `larger than ${this.values.minimum}`;
        } else if (this.values.maximum) { // if we have the maximum only
            return `smaller than ${this.values.maximum}`;
        } else { // if we don't have any
            return '';
        }
    }

    /**
     * Handle the input fields and values dependent on specific types of simple fields.
     * If a field editor is generated for the first time, include the appropriate fields.
     * If a different type is chosen while editing the field, add/remove the appropriate fields.
     * @param {String} format Selected type of the input field.
     */
    manage_format(format) {
        // Have a minimum or maximum values been defined?
        let has_range = this.values.minimum != undefined || this.values.maximum != undefined;

        // ID of the input fields for minimum and maximum (for numbers)
        let min_id = `${this.id}-min`;
        let max_id = `${this.id}-max`;

        // DIV and input fields for the default value (not always present)
        let default_div = this.form_field.form.querySelector(`#div-${this.id}-default`);
        
        // add or remove default based on type
        if (format == 'textarea' || format == 'checkbox') {
            if (default_div != null) {
                this.form_field.form.removeChild(default_div);
            }
            this.default = undefined;
            if (format == 'checkbox') {
                this.required = false;
                this.repeatable = false;
            }
        } else {
            this.add_default_field();
        }

        let default_input = this.form_field.form.querySelector(`#${this.id}-default`);

        // disable or enable switches based on type (if they have already been created)
        let switches_div = this.form_field.form.querySelector('div#switches-div');
        if (switches_div != undefined) {
            let switches = switches_div.querySelectorAll('input[role="switch"]');
            if (format == 'checkbox') {
                switches.forEach((sw) => { sw.setAttribute('disabled', '') });
            } else {
                switches.forEach((sw) => sw.removeAttribute('disabled'));
            }
        }

        // add or remove range inputs based on type
        if (format == "integer" | format == 'float') {
            // adapt the type of the default input field
            if (default_input !== null) { default_input.type = 'number'; }

            // if there is no field for minimum and maximum yet
            // (because the numeric type has just been selected via the dropdown)
            if (this.form_field.form.querySelector('#' + min_id) == undefined) {
                // add input field for the minimum value
                this.form_field.add_input("Minimum", min_id,
                    {
                        placeholder: '0',
                        value: has_range ? this.values.minimum : false, // value if it exists
                        validation_message: "This field is compulsory and the value must be lower than the maximum.",
                        required: false
                    });

                this.form_field.add_input("Maximum", max_id,
                    {
                        placeholder: '100',
                        value: has_range ? this.values.maximum : false, // value if it exists
                        validation_message: "This field is compulsory and the value must be higher than the minimum.",
                        required: false
                    });
            }
            // assign the right type to the input fields for minimum and maximum
            let min_button = this.form_field.form.querySelector('#' + min_id);
            min_button.type = 'number';
            let max_button = this.form_field.form.querySelector('#' + max_id);
            max_button.type = 'number';

            // allow decimals for float input
            if (format == 'float') {
                min_button.setAttribute('step', 'any');
                max_button.setAttribute('step', 'any');
                if (default_input !== null) { default_input.setAttribute('step', 'any'); }
            }

            // adapt minima of maximum and default fields when a new minimum is provided
            min_button.addEventListener('change', () => {
                max_button.min = min_button.value;
                if (default_input != null) {
                    default_input.min = min_button.value;
                }
            });

            // adapt maxima of minimum and default fields when a new maximum is provided
            max_button.addEventListener('change', () => {
                min_button.max = max_button.value;
                default_input.max = max_button.value;
            });
        } else { // if the field is not numeric (anymore)
            // remove the min and max input fields
            if (this.form_field.form.querySelectorAll('.form-container [type="number"]').length > 0) {
                this.form_field.form.removeChild(document.getElementById(`div-${min_id}`));
                this.form_field.form.removeChild(document.getElementById(`div-${max_id}`));
            }

            // if minimum and maximum values had been provided
            if (has_range) {
                delete this.values.minimum;
                delete this.values.maximum;
            }

            // adapt the type of the default input
            if (default_input !== null) { default_input.type = format; }
        }

        // adapt the description of the default input field based on the type
        if (default_input !== null) {
            let num_validator = default_input.input == 'number' ? this.print_range() : '';
            let validator = `This field must be of type ${format}${num_validator}.`
            default_input.parentElement
                .querySelector('.invalid-feedback')
                .innerHTML = validator;
        }
    }

    /**
     * Parse an object to fill in the properties of the object instance.
     * Next to the parent class workflow, define the subtitle and retrieve the minimum and maximum for numeric inputs.
     * @param {FieldInfo} data JSON representation of the contents of the field.
     */
    from_json(data) {
        super.from_json(data);
        let par_text = this.type;
        if (this.type == 'integer' | this.type == 'float') {
            this.values = { 'minimum': data.minimum, 'maximum': data.maximum };
            let range_text = this.print_range();
            par_text = `${this.type} ${range_text}`;
        }
        this.viewer_subtitle = `Input type: ${par_text}`;
    }

    /**
     * Create an example of a Simple Field.
     * @static
     * @returns {HTMLInputElement} The field to add in an illustration example.
     */
    static ex_input() {
        let inner_input = Field.quick("input", "form-control");
        inner_input.value = "Some text";
        inner_input.setAttribute('readonly', '');
        return inner_input;
    }

    /**
     * If relevant, create and add an input field for the default value.
     */
    add_default_field() {
        // if the field does not exist yet (it may have been removed for textarea and checkbox)
        if (this.form_field.form.querySelector(`#div-${this.id}-default`) == undefined) {
            this.form_field.add_input(
                'Default value', `${this.id}-default`,
                {
                    description: "Default value for this field: only valid if the field is required.",
                    value: this.default, required: false
                }
            );
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
        let div = document.createElement('div');

        // set up input field description as subtitle or as input-description
        let subtitle = active ?
            Field.quick('div', 'form-text', this.viewer_subtitle) :
            Field.quick('p', 'card-subtitle', this.viewer_subtitle);
        subtitle.id = 'help-' + this.id;

        // define input shape
        let input;
        if (this.type == 'textarea') {
            input = Field.quick("textarea", "form-control input-view");
        } else if (this.type == 'checkbox') {

            // single checkbox with no text and only "true" as possible value
            input = Field.quick('div', 'form-check');
            let input_input = Field.quick('input', 'form-check-input');
            input_input.type = 'checkbox';
            input_input.value = true;
            input_input.id = 'check-' + this.id;
            let input_label = Field.quick('label', 'form-check-label visually-hidden', 'Check if true.');
            input_label.setAttribute('for', 'check-' + this.id);
            input.appendChild(input_input);
            input.appendChild(input_label);
        } else {
            // input with the right type (for validation and other features)
            input = Field.quick("input", "form-control input-view");
            input.type = this.type == 'float' | this.type == 'integer' ? 'number' : this.type;
            input.setAttribute('aria-describedby', subtitle.id);
            // only these types can be required and have a default value
            if (this.required && this.default !== undefined) {
                input.value = this.default;
            }
        }

        // define value
        if (!active) { // in the manager
            if (this.type == 'checkbox') {
                input.querySelector('input').setAttribute('readonly', '')
            } else {
                input.setAttribute('readonly', '');
                div.appendChild(subtitle);
            }
            div.appendChild(input);
        } else { // when implementing form
            div.appendChild(input);
            let value = Field.include_value(this);

            if (this.type == 'checkbox') {
                input.querySelector('input').name = this.name;
                if (value) {
                    input.querySelector('input').setAttribute('checked', '');
                }
            } else {
                input.name = this.name;
                if (this.required) { input.setAttribute('required', ''); }
                if (value != undefined) { input.value = value; }
                if (this.values.minimum != undefined) { input.min = this.values.minimum; }
                if (this.values.maximum != undefined) { input.max = this.values.maximum; }
                div.appendChild(subtitle);
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
        let text_options = [
            "text", "textarea", "email", "url",
            "date", "time", "datetime-local",
            "integer", "float",
            "checkbox"];
        this.form_field.add_select("Input type", `${this.id}-format`, text_options, this.type);

        // when selecting from the dropdown, adapt the contents of the form
        this.form_field.form.querySelector(".form-select").addEventListener('change', () => {
            let selected = this.form_field.form.elements[`${this.id}-format`].value;
            this.manage_format(selected)
        });

        // add any other relevant input field
        this.manage_format(this.type);

        // finish form
        this.end_form();
    }

    /**
     * Read the form used to edit the field and register the values (on submission).
     * @param {FormData} data Contents of the editing form of the field.
     */
    recover_fields(data) {
        // capture type
        this.type = data.get(`${this.id}-format`);
        let par_text = this.type;

        // capture minimum and maximum values if relevant
        if (this.type === "integer" | this.type == 'float') {
            this.values.minimum = data.get(`${this.id}-min`);
            this.values.maximum = data.get(`${this.id}-max`);
            // this.type = "number";
            let range_text = this.print_range();
            par_text = `${this.type} ${range_text}`;
        }

        // define the description of the field for the viewer and editor
        this.viewer_subtitle = `Input type: ${par_text}`;
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
        if (form.querySelector(`#div-${this.id}-default`) != undefined) {
            form.querySelector(`#${this.id}-default`).type = 'text';
        }
        super.reset();
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
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
    }

    form_type = "object";
    button_title = "Composite field";
    description = "This can contain any combination of the previous form elements.<br>"

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
            type: 'object'
        }

        if (this.required) json.required = this.required;
        if (this.repeatable) json.repeatable = this.repeatable; // temporarily not implemented
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
        inner_input.querySelectorAll('input').forEach((input) => input.setAttribute('readonly', ''));
        inner_input.setAttribute('style', 'display:block;');
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
        // (although while the composite field is not repeatable, there are no switches)
        const switches = this.form_field.form.querySelector('#switches-div');
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
    constructor(schema_name, data_status = 'draft') {
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
        this.values = { 'values': data.values, 'multiple': data.multiple, 'ui': data.ui };
    }

    /**
     * Create an element with the right type of input field, either to view in a schema-view or to fill in annotation.
     * @param {Boolean} active Whether the form is meant to be used in annotation.
     * @returns {HTMLDivElement}
     */
    viewer_input(active = false) {
        let div = this.values.ui == 'dropdown' // If UI is 'dropdown'
            ? Field.dropdown(this, active) // create a dropdown
            : Field.checkbox_radio(this, active); // otherwise a checkbox or radio
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
    recover_fields(data) {
        // reset whatever values existing
        this.values.values = [];
        // go through values in the form
        for (let pair of data.entries()) {
            // add the value of moving input fields only
            if (pair[0].startsWith("mover")) { this.values.values.push(pair[1]); }
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
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.values.multiple = false;
        this.values.ui = 'radio';
    }
    
    form_type = "selection";
    button_title = "Singe-value multiple choice";
    dropdown_alt = 'radio';

    /**
     * If relevant, create and add a dropdown for the default value.
     * The dropdown options do not adapt as you edit the possible options because that's too much work.
     * But once you have saved your input, the next edit will offer the right options.
     */
    add_default_field() {
        this.form_field.add_select(
            "Default value (if field is required)",
            `${this.id}-default`,
            this.values.values);
    }

    /**
     * Create an example of a Single-value Multiple Choice field
     * @static
     * @returns {HTMLInputElement} The field to add in an illustration example.
     */
    static ex_input() {
        // create two columns, one to show a dropdown and one for radio buttons
        let columns = Field.quick('div', 'row h-50');
        let col1 = Field.quick('div', 'col-6 p-2 mb-2');
        let col2 = Field.quick('div', 'col-6 p-2 mb-2');
        columns.appendChild(col1);
        columns.appendChild(col2);
        
        // create a dummy version for illustration with three default values
        let example_input = new SelectInput('example');
        example_input.values.values = ['one', 'two', 'three'];
        example_input.name = 'select-example';

        // create the dropdown rendering of the illustrative example and append to left column
        let dropdown = Field.dropdown(example_input);
        dropdown.querySelector('option[value="one"]').setAttribute('selected', '');
        dropdown.setAttribute('readonly', '');
        col1.appendChild(dropdown);
        
        // create the radio rendering of the illustrative example and append to right column
        let radio = Field.checkbox_radio(example_input);
        radio.querySelector('input[value="one"]').setAttribute('checked', '');
        radio.querySelectorAll('input').forEach((input) => input.setAttribute('readonly', ''));
        col2.appendChild(radio);
        
        return columns;
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
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.values.multiple = true;
        this.values.ui = 'checkbox';
    }

    form_type = "checkbox";
    button_title = "Multiple-value multiple choice";
    dropdown_alt = 'checkbox';

    /**
     * Create an example of a Multiple-value Multiple Choice field
     * @static
     * @returns {HTMLInputElement} The field to add in an illustration example.
     */
    static ex_input() {
        // create two columns, one to show a dropdown and one for checkboxes
        let columns = Field.quick('div', 'row');
        let col1 = Field.quick('div', 'col-6 p-2');
        let col2 = Field.quick('div', 'col-6 p-2');
        columns.appendChild(col1);
        columns.appendChild(col2);
        
        // create a dummy version for illustration with three default values
        let example_input = new CheckboxInput('example');
        example_input.values.values = ['one', 'two', 'three'];
        example_input.name = 'checkbox-example';
        
        // create the dropdown rendering of the illustrative example and append to left column
        let dropdown = Field.dropdown(example_input);
        dropdown.querySelectorAll('option')
            .forEach((option) => {
                if (option.value == "one" || option.value == "two") option.setAttribute('selected', '');
            });
        dropdown.setAttribute('readonly', '');
        col1.appendChild(dropdown);
        
        // create the checkboxes rendering of the illustrative example and append to right column
        let checkboxes = Field.checkbox_radio(example_input);
        checkboxes.querySelectorAll('input').forEach((input) => {
            if (input.value != "three") input.setAttribute('checked', '');
            input.setAttribute('readonly', '');
        })
        col2.appendChild(checkboxes);
        
        return columns;
    }
}
