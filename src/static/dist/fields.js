class InputField {
    constructor(schema_name, data_status = 'draft') {
        this.description = ""; // description to show in the options viewer
        this.dummy_title = "Informative label"; // dummy title in options viewer (probably could go)
        this.required = false; // whether the field is required
        this.values = {}; // values to return in the json
        this.mode = 'add'; // whether the form has to be created or edited ("mod")
        this.repeatable = false;
        this.schema_name = schema_name;
        this.is_duplicate = false;
        this.schema_status = data_status;
    }

    get json() {
        return this.to_json();
    }

    to_json() {
        let json = { title: this.title, type: this.type, ...this.values };
        if (this.required) {
            json.required = this.required;
            if (this.default) json.default = this.default;
        }
        if (this.repeatable) json.repeatable = this.repeatable;
        return json;
    }

    create_example() {
        let example = Field.quick("div", "ex my-2", this.description);

        let inner_label = Field.quick("label", "form-label h6", this.dummy_title);

        example.appendChild(inner_label);
        example.appendChild(this.constructor.ex_input());
        return example;
    }

    render(schema) {
        this.id = `${this.form_type}-${schema.id}`;
        this.create_form();

        let new_form = Field.quick("div", "shadow border rounded p-4 mb-3");

        let new_button = Field.quick("button", "btn btn-primary choice-button", this.button_title);
        this.create_modal(schema)

        new_button.setAttribute("data-bs-toggle", "modal");
        let modal_id = `add-${this.id}-${this.schema_name}-${schema.data_status}`;
        new_button.setAttribute("data-bs-target", '#' + modal_id);

        new_form.appendChild(new_button);
        new_form.appendChild(this.create_example());

        return new_form;
    }

    setup_form() {
        this.form_field = new BasicForm(this.id);
        this.form_field.add_input(
            `ID for ${this.form_type} (underlying label)`, `${this.id}-id`,
            {
                description: "Use lowercase or numbers, no spaces, no special characters other than '_'.",
                value: this.field_id, validation_message: "This field is compulsory. Use only lowercase, numbers, and '_'.",
                pattern: "[a-z0-9_]+"
            }
        );
        this.form_field.add_input(
            `Label for ${this.form_type} (display name)`, `${this.id}-label`,
            {
                description: "This is what an user will see when inserting metadata.",
                value: this.title
            });
    }

    add_default_field() {
        return;
    }

    end_form() {
        let this_class = this.constructor.name;

        this.add_default_field();

        // Add require switch and submit button to form
        this.form_field.form.appendChild(document.createElement('br'));
        let dropdownable = this_class == 'SelectInput' | this_class == 'CheckboxInput';
        // ObjectInput included as in_object to TEMPORARILY disable repeatable objects
        let in_object = this.schema_status.startsWith('object') || this_class == 'ObjectInput';
        let requirable = !(this_class == 'CheckboxInput' | this_class == 'ObjectInput');
        let switchnames = requirable ? ['required'] : [];
        let switches = requirable ? { required: this.required } : {};
        if (dropdownable) {
            switchnames.push('dropdown');
            switches.dropdown = this.values.ui == 'dropdown';
        } else if (!in_object) {
            switchnames.push('repeatable');
            switches.repeatable = this.repeatable;
        }
        this.form_field.add_switches(this.id, switchnames, switches);

        if (requirable) {
            let req_input = this.form_field.form.querySelector(`#${this.id}-required`);
            req_input.addEventListener('change', () => {
                this.required = !this.required;
                this.required ? req_input.setAttribute('checked', '') : req_input.removeAttribute('checked');
            });
        }
        if (dropdownable) {
            let dd_input = this.form_field.form.querySelector(`#${this.id}-dropdown`);
            dd_input.addEventListener('change', () => {
                this.values.ui = this.values.ui == 'dropdown' ? this.dropdown_alt : 'dropdown';
                this.values.ui == 'dropdown' ? dd_input.setAttribute('checked', '') : dd_input.removeAttribute('checked');
            });
        } else if (!in_object) {
            let rep_input = this.form_field.form.querySelector(`#${this.id}-repeatable`);
            rep_input.addEventListener('change', () => {
                this.repeatable = !this.repeatable;
                this.repeatable ? rep_input.setAttribute('checked', '') : rep_input.removeAttribute('checked');
            });
        }

        this.form_field.add_action_button(this.mode == 'add'
            ? `Add to ${this.schema_status.startsWith('object') ? 'object' : 'schema'}`
            : "Update",
            'add');

    }

    create_modal(schema) {
        let modal_id = `${this.mode}-${this.id}-${this.schema_name}-${this.schema_status}`;
        let edit_modal = new Modal(modal_id, `Add ${this.button_title}`, `title-${this.form_type}`);
        let form = this.form_field.form;
        edit_modal.create_modal([form], 'lg');
        this.modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(modal_id));
        let modal_dom = document.getElementById(modal_id);

        this.form_field.add_submit_action('add', (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add('was-validated');
            } else {
                // if the id is repeated it will replace the other field
                let clone = this.register_fields(schema);
                form.classList.remove('was-validated');
                this.modal.toggle();
                if (schema.constructor.name == 'ObjectEditor') {
                    let parent_modal_dom = document.getElementById(`${schema.card_id}`);
                    let parent_modal = bootstrap.Modal.getOrCreateInstance(parent_modal_dom);
                    parent_modal.toggle();
                }
                modal_dom.querySelector('.modal-body').appendChild(form);

                let clone_modal_id = `${clone.mode}-${clone.id}-${clone.schema_name}-${clone.schema_status}`;
                if (clone_modal_id != modal_id) {
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

    register_fields(schema) {
        // Read data from the modal form
        // With this form we create a new instance of the class with the output of the form
        // and give it to the schema as a created field
        // Then we reset this form so we can create more fields
        let data = new FormData(this.form_field.form);
        let old_id = this.id;
        let new_id = data.get(`${this.id}-id`);
        if (this.required) {
            this.default = data.get(`${this.id}-default`);
        }
        if (old_id == new_id) {
            this.title = data.get(`${this.id}-label`);
            this.recover_fields(data);
            schema.update_field(this);
            return this;
        } else {
            let clone = new this.constructor(schema.initial_name, this.schema_status);
            clone.field_id = new_id;
            clone.form_field = this.form_field;
            clone.title = data.get(`${this.id}-label`);

            clone.required = this.required;
            this.required = false;

            clone.repeatable = this.repeatable;
            this.repeatable = false;

            clone.default = this.default;
            this.default = undefined;

            clone.id = this.id // temporarily, to recover data

            if (this.constructor.name == 'ObjectInput') {
                // this will have to change to adapt to creating filled-schemas (attached to new ids)
                clone.editor = this.editor;
                delete this.editor;
                this.create_editor();
            }

            clone.recover_fields(data);
            clone.id = clone.field_id;
            this.reset(); // specific

            clone.mode = 'mod';
            clone.create_form();

            clone.create_modal(schema);

            if (this.mode == 'mod') {
                schema.replace_field(old_id, clone);
            } else {
                schema.add_field(clone);
            }
            return clone;
        }

    }

    view(schema) {
        // Method to view the created form
        return new MovingViewer(this, schema);
    }

    reset() {
        this.form_field.reset();
        this.default = undefined;
    }

    static choose_class(schema_name, data_status, [id, data] = []) {
        let new_field;
        if (data.type == 'object') {
            new_field = new ObjectInput(schema_name, data_status);
        } else if (data.type == 'select') {
            new_field = data.multiple ? new CheckboxInput(schema_name, data_status) : new SelectInput(schema_name, data_status);
        } else {
            new_field = new TypedInput(schema_name, data_status);
        }
        new_field.field_id = id;
        new_field.id = id;
        new_field.mode = 'mod';
        new_field.from_json(data);
        return new_field;
    }

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
}

class TypedInput extends InputField {
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.type = "text";
        this.values = {};
    }

    form_type = "text";
    form_type = "text";
    button_title = "Simple field";
    description = "Text options: regular text, number (integer or float), date, time, e-mail or URL.<br>"

    static ex_input() {
        let inner_input = Field.quick("input", "form-control");
        inner_input.value = "Some text";
        inner_input.setAttribute('readonly', '');
        return inner_input;
    }
    add_default_field() {
        if (this.form_field.form.querySelector(`#div-${this.id}-default`) == null) {
            this.form_field.add_input(
                'Default value', `${this.id}-default`,
                {
                    description: "Default value for this field: only valid if the field is required.",
                    value: this.default, required: false
                }
            );
        }
    }

    viewer_input(active = false) {
        let div = document.createElement('div');
        let subtitle = active ?
            Field.quick('div', 'form-text', this.viewer_subtitle) :
            Field.quick('p', 'card-subtitle', this.viewer_subtitle);
        subtitle.id = 'help-' + this.id;
        let input;
        if (this.type != 'textarea') {
            input = Field.quick("input", "form-control input-view");
            input.type = this.type == 'float' | this.type == 'integer' ? 'number' : this.type;
            input.setAttribute('aria-describedby', subtitle.id);
            if (this.required && this.default !== undefined) {
                input.value = this.default;
            }
        } else {
            input = Field.quick("textarea", "form-control input-view");
        }
        if (!active) {
            input.setAttribute('readonly', '');
            div.appendChild(subtitle);
            div.appendChild(input);
        } else {
            input.name = this.name;
            if (this.required) {
                input.setAttribute('required', '');
            }
            let value = Field.include_value(this);
            if (value != undefined) {
                input.value = value;
            }
            if (this.values.minimum != undefined) {
                input.min = this.values.minimum;
                input.max = this.values.maximum;
            }
            div.appendChild(input);
            div.appendChild(subtitle);

        }
        return div;
    }

    to_json() {
        let json = super.to_json();
        if (this.type == 'number' || this.type == 'float') {
            delete json.format;
        }
        return json;
    }

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

    reset() {
        let form = this.form_field.form;
        if (document.getElementById(`div-${this.id}-min`) != undefined) {
            form.removeChild(document.getElementById(`div-${this.id}-min`));
            form.removeChild(document.getElementById(`div-${this.id}-max`));
        }
        super.reset();
        // form.reset();
        // form.classList.remove('was-validated');
    }

    manage_format(format) {
        // Add or remove the fields to set minimum and maximum value when input is numeric
        // Also add or remove default field depending on whether it's a textarea
        let has_range = Object.keys(this.values).indexOf('minimum') > -1;
        
        let min_id = `${this.id}-min`;
        let max_id = `${this.id}-max`;

        let default_div = this.form_field.form.querySelector(`#div-${this.id}-default`);
        let default_input = this.form_field.form.querySelector(`#${this.id}-default`);

        if (format == 'textarea') {
            if (default_div != null) {
                this.form_field.form.removeChild(default_div);
            }
            this.default = undefined;
        } else {
            this.add_default_field();
        }

        if (format == "integer" | format == 'float') {
            if (default_input !== null) {
                default_input.type = 'number';
            }

            if (this.form_field.form.querySelector('#' + min_id) == undefined) {
                this.form_field.add_input("Minimum", min_id,
                    {
                        placeholder: '0',
                        value: has_range ? this.values.minimum : false,
                        validation_message: "This field is compulsory and the value must be lower than the maximum.",
                        required: false
                    });

                this.form_field.add_input("Maximum", max_id,
                    {
                        placeholder: '100',
                        value: has_range ? this.values.maximum : false,
                        validation_message: "This field is compulsory and the value must be lower than the minimum.",
                        required: false
                    });

            }
            let min_button = this.form_field.form.querySelector('#' + min_id);
            min_button.type = 'number';
            let max_button = this.form_field.form.querySelector('#' + max_id);
            max_button.type = 'number';

            if (format == 'float') {
                min_button.setAttribute('step', 'any');
                max_button.setAttribute('step', 'any');
                if (default_input !== null) {
                    default_input.setAttribute('step', 'any');
                }
            }

            min_button.addEventListener('change', () => {
                max_button.min = min_button.value;
                if (default_input != null) {
                    default_input.min = min_button.value;
                }
            });
            max_button.addEventListener('change', () => {
                min_button.max = max_button.value;
                default_input.max = max_button.value;
            });
        } else {
            if (this.form_field.form.querySelectorAll('.form-container [type="number"]').length > 0) {
                this.form_field.form.removeChild(document.getElementById(`div-${min_id}`));
                this.form_field.form.removeChild(document.getElementById(`div-${max_id}`));
            }
            if (has_range) {
                delete this.values.minimum;
                delete this.values.maximum;
            }

            if (format == 'textarea') {

            } else if (default_input !== null) {
                default_input.type = format;
            }
        }
        if (default_input !== null) {
            let num_validator = default_input.input == 'number' ? this.print_range() : '';
            let validator = `This field must be of type ${format}${num_validator}.`
            default_input.parentElement
                .querySelector('.invalid-feedback')
                .innerHTML = validator;
        }
    }

    create_form() {
        this.setup_form();
        let text_options = ["text", "textarea", "date", "email", "time", "url", "integer", "float"];
        this.form_field.add_select("Text type", `${this.id}-format`, text_options, this.type);
        this.manage_format(this.type);
        this.form_field.form.querySelector(".form-select").addEventListener('change', () => {
            let selected = this.form_field.form.elements[`${this.id}-format`].value;
            this.manage_format(selected)
        });
        this.end_form();
    }

    recover_fields(data) {
        this.type = data.get(`${this.id}-format`);
        let par_text = this.type;
        if (this.type === "integer" | this.type == 'float') {
            this.values.minimum = data.get(`${this.id}-min`);
            this.values.maximum = data.get(`${this.id}-max`);
            // this.type = "number";
            let range_text = this.print_range();
            par_text = `${this.type} ${range_text}`;
        }
        this.viewer_subtitle = `Input type: ${par_text}`;
    }

    print_range() {
        if (this.values.minimum && this.values.maximum) {
            // if we have both values
            return `between ${this.values.minimum} and ${this.values.maximum}`;
        } else if (this.values.minimum) {
            // if we have the minimum
            return `larger than ${this.values.minimum}`;
        } else if (this.values.maximum) {
            // if we have the maximum
            return `smaller than ${this.values.maximum}`;
        } else {
            // if we don't have any
            return '';
        }
        
    }

}

class ObjectInput extends InputField {
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.form_type = "object";
        this.button_title = "Composite field";
        this.description = "This can contain any combination of the previous form elements.<br>"
    }

    static ex_input() {
        let mini_object = new DummyObject();
        let inner_input = ComplexField.create_viewer(mini_object, true);
        inner_input.querySelectorAll('input').forEach((input) => input.setAttribute('readonly', ''));
        inner_input.setAttribute('style', 'display:block;');
        return inner_input;
    }

    create_editor() {
        if (this.editor == undefined) {
            this.editor = new ObjectEditor(this);
        } else {
            this.editor.form_id = this.form_field.form.id;
        }
        this.editor.display_options();
    }

    create_modal(schema) {
        super.create_modal(schema);
        this.editor.card_id = `${this.mode}-${this.id}-${this.schema_name}-${this.schema_status}`;
        if (this.editor.field_ids.length > 0) {
            this.editor.field_ids.forEach((field_id, idx) => {
                this.editor.new_field_idx = idx;
                this.editor.view_field(this.editor.fields[field_id]);
            });
        }
    }

    viewer_input(active = false) {
        return ComplexField.create_viewer(this.editor, active);
    }

    create_form() {
        this.setup_form();
        this.create_editor();
        if (this.json_source != undefined) {
            this.editor.from_json(this.json_source);
        }
        this.end_form();
        const switches = this.form_field.form.querySelector('#switches-div');
        this.form_field.form.insertBefore(this.editor.button, switches);

    }

    recover_fields(data) {
        // I'm not so sure about this one...
        this.properties = {};
        this.editor.field_ids.forEach((field_id) => {
            let field = this.editor.fields[field_id];
            this.properties[field_id] = field.json;
        });
    }

    to_json() {
        // this.editor.name = this.form_field.form
        //     .querySelector(`[name="${this.editor.id_field}"]`)
        //     .value;
        this.editor.fields_to_json();
        let json = {
            title: this.title,
            properties: this.editor.properties,
            type: 'object'
        }

        if (this.required) json.required = this.required;
        if (this.repeatable) json.repeatable = this.repeatable;
        return json;
    }

    from_json(data) {
        super.from_json(data);
        this.json_source = data;
    }
}

class MultipleInput extends InputField {
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.type = "select";
        this.values.values = [];
    }

    repeatable = false;

    viewer_input(active = false) {
        // I just send the Fields data (values, actual value, and name if active)
        let div = this.values.ui == 'dropdown' ?
            Field.dropdown(this, active) :
            Field.checkbox_radio(this, active);
        return div;
    }

    create_form() {
        this.setup_form();
        this.form_field.add_moving_options("Select option", this.values.values);
        this.end_form();
    }

    reset() {
        let form = this.form_field.form;
        while (form.querySelectorAll(".blocked").length > 2) {
            MovingChoice.remove_div(form.querySelector(".blocked"));
        }
        super.reset();
        // form.reset();
        // form.classList.remove('was-validated');
    }

    recover_fields(data) {
        this.values.values = [];
        for (let pair of data.entries()) {
            if (pair[0].startsWith("mover")) {
                this.values.values.push(pair[1]);
            }
        }
    }

    from_json(data) {
        super.from_json(data);
        this.values = { 'values': data.values, 'multiple': data.multiple, 'ui': data.ui };
        this.create_form();
    }
}

// The classes above can probably be removed
class SelectInput extends MultipleInput {
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.form_type = "selection";
        this.button_title = "Singe-value multiple choice";
        this.values.multiple = false;
        this.values.ui = 'radio';
    }
    dropdown_alt = 'radio';

    add_default_field() {
        this.form_field.add_select("Default value (if field is required)", `${this.id}-default`, this.values.values);
    }
    static ex_input() {
        let columns = Field.quick('div', 'row h-50');
        let example_input = new SelectInput('example');
        example_input.values.values = ['one', 'two', 'three'];
        example_input.name = 'select-example';
        let dropdown = Field.dropdown(example_input);
        dropdown.querySelector('option[value="one"]').setAttribute('selected', '');
        dropdown.setAttribute('readonly', '');
        let radio = Field.checkbox_radio(example_input);
        radio.querySelector('input[value="one"]').setAttribute('checked', '');
        radio.querySelectorAll('input').forEach((input) => input.setAttribute('readonly', ''));
        let col1 = Field.quick('div', 'col-6 p-2 mb-2');
        col1.appendChild(dropdown);
        let col2 = Field.quick('div', 'col-6 p-2 mb-2');
        col2.appendChild(radio);
        columns.appendChild(col1);
        columns.appendChild(col2);
        return columns;
    }
}

class CheckboxInput extends MultipleInput {
    constructor(schema_name, data_status = 'draft') {
        super(schema_name, data_status);
        this.form_type = "checkbox";
        this.button_title = "Multiple-value multiple choice";
        this.values.multiple = true;
        this.values.ui = 'checkbox';
    }
    dropdown_alt = 'checkbox';
    
    static ex_input() {
        let columns = Field.quick('div', 'row');
        let example_input = new CheckboxInput('example');
        example_input.values.values = ['one', 'two', 'three'];
        example_input.name = 'checkbox-example';
        let dropdown = Field.dropdown(example_input);
        dropdown.querySelectorAll('option')
            .forEach((option) => {
                if (option.value == "one" || option.value == "two") option.setAttribute('selected', '');
            });
        dropdown.setAttribute('readonly', '');
        let checkboxes = Field.checkbox_radio(example_input);
        checkboxes.querySelectorAll('input').forEach((input) => {
            if (input.value != "three") input.setAttribute('checked', '');
            input.setAttribute('readonly', '');
        })
        let col1 = Field.quick('div', 'col-6 p-2');
        col1.appendChild(dropdown);
        let col2 = Field.quick('div', 'col-6 p-2');
        col2.appendChild(checkboxes);
        columns.appendChild(col1);
        columns.appendChild(col2);
        return columns;
    }
}
