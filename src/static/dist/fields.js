class InputField {
    constructor(schema_name) {
        this.description = ""; // description to show in the options viewer
        this.dummy_title = "Title"; // dummy title in options viewer (probably could go)
        this.required = false; // whether the field is required
        this.values = {}; // values to return in the json
        this.mode = 'add'; // whether the form has to be created or edited ("mod")
        this.repeatable = false;
        this.schema_name = schema_name;
    }

    get json() {
        return this.to_json();
    }

    to_json() {
        let json = { title: this.title, type: this.type, ...this.values };
        if (this.required) json.required = this.required;
        if (this.repeatable) json.repeatable = this.repeatable;
        return json;
    }

    create_example() {
        let example = Field.quick("div", "ex my-2", this.description);

        let inner_label = Field.quick("label", "form-label h6", this.dummy_title);

        example.appendChild(inner_label);
        example.appendChild(this.ex_input());
        return example;
    }

    render(schema, id) {
        this.id = `${this.form_type}-${schema.id}`;
        this.create_form();

        let new_form = Field.quick("div", "border HTMLElement rounded");

        let new_button = Field.quick("button", "btn btn-primary HTMLElementButton", this.button_title);
        this.create_modal(schema, id)

        new_button.setAttribute("data-bs-toggle", "modal");
        new_button.setAttribute("data-bs-target", `#add-${this.id}-${this.schema_name}`);

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

    end_form() {
        // Add require switch and submit button to form
        this.form_field.form.appendChild(document.createElement('br'));
        let this_class = this.constructor.name;
        let repeatable = !(this_class == 'SelectInput' | this_class == 'CheckboxInput')
        let switchnames = ['required'];
        let switches = {required : this.required};
        if (repeatable) {
            switchnames.push('repeatable');
            switches.repeatable = this.repeatable;
        } else {
            switchnames.push('dropdown');
            switches.dropdown = this.values.ui == 'dropdown';
        }
        this.form_field.add_switches(this.id, switchnames, switches);
        
        let req_input = this.form_field.form.querySelector(`#${this.id}-required`);
        req_input.addEventListener('change', () => {
            this.required = !this.required;
            this.required ? req_input.setAttribute('checked', '') : req_input.removeAttribute('checked');
        });
        if (repeatable) {
            let rep_input = this.form_field.form.querySelector(`#${this.id}-repeatable`);
            rep_input.addEventListener('change', () => {
                this.repeatable = !this.repeatable;
                this.repeatable ? rep_input.setAttribute('checked', '') : rep_input.removeAttribute('checked');
            });    
        } else {
            let dd_input = this.form_field.form.querySelector(`#${this.id}-dropdown`);
            dd_input.addEventListener('change', () => {
                this.values.ui = this.values.ui == 'dropdown' ? this.dropdown_alt : 'dropdown';
                this.values.ui == 'dropdown' ? dd_input.setAttribute('checked', '') : dd_input.removeAttribute('checked');
            });    
        }
        
        this.form_field.add_action_button(this.mode == 'add' ? "Add to schema" : "Update", 'add');

    }

    create_modal(schema, id) {
        let modal_id = `${this.mode}-${this.id}-${this.schema_name}`;
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
                let clone = this.register_fields(schema, id);
                form.classList.remove('was-validated');
                this.modal.toggle();
                if (schema.constructor.name == 'ObjectEditor') {
                    let parent_modal_dom = document.getElementById(schema.card_id);
                    let parent_modal = bootstrap.Modal.getOrCreateInstance(parent_modal_dom);
                    parent_modal.toggle();
                }
                modal_dom.querySelector('.modal-body').appendChild(form);

                let clone_modal_id = `${clone.mode}-${clone.id}-${clone.schema_name}`;
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
        })
    }

    register_fields(schema, id) {
        // Read data from the modal form
        // With this form we create a new instance of the class with the output of the form
        // and give it to the schema as a created field
        // Then we reset this form so we can create more fields
        let data = new FormData(this.form_field.form);
        let old_id = this.id;
        let new_id = data.get(`${this.id}-id`);
        if (old_id == new_id) {
            this.title = data.get(`${this.id}-label`);
            this.recover_fields(data);
            schema.update_field(this);
            return this;
        } else {
            let clone = new this.constructor(schema.initial_name);
            clone.field_id = new_id;
            clone.form_field = this.form_field;
            clone.title = data.get(`${this.id}-label`);

            clone.required = this.required;
            this.required = false;

            clone.repeatable = this.repeatable;
            this.repeatable = false;

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

            if (this.mode == 'mod') {
                schema.replace_field(old_id, clone, id);
            } else {
                clone.mode = 'mod';
                
                clone.create_form();

                clone.create_modal(schema, id);
                schema.add_field(clone, id);

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
    }

    static choose_class(schema_name, [id, data] = []) {
        let new_field;
        if (data.type == 'object') {
            new_field = new ObjectInput(schema_name);
        } else if (data.type == 'select') {
            new_field = data.multiple ? new CheckboxInput(schema_name) : new SelectInput(schema_name);
        } else {
            new_field = new TypedInput(schema_name);
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
        if (data.required) this.required = data.required;
        if (data.repeatable) this.repeatable = data.repeatable;

    }
}

class TypedInput extends InputField {
    constructor(schema_name) {
        super(schema_name);
        this.type = "text";
        this.values = {};
    }

    form_type = "text";
    form_type = "text";
    button_title = "Text input";
    description = "Text options: regular text, number (integer or float), date, time, e-mail or URL.<br>"    

    ex_input() {
        let inner_input = Field.quick("input", "form-control");
        inner_input.placeholder = "example placeholder";
        return inner_input;
    }

    viewer_input() {
        let div = document.createElement('div');
        let subtitle = Field.quick('p', 'card-subtitle', this.viewer_subtitle);
        let input;
        if (this.type != 'textarea') {
            input = Field.quick("input", "form-control input-view");
            input.type = this.type == 'float' | this.type == 'integer' ? 'number' : this.type;
        } else {
            input = Field.quick("textarea", "form-control input-view");
        }
        input.setAttribute('readonly', '');
        div.appendChild(subtitle);
        div.appendChild(input);
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
        if (this.type == 'integer' | this.type == 'float' ) {
            this.values = { 'minimum' : data.minimum, 'maximum' : data.maximum};
            par_text = `${this.type} between ${data.minimum} and ${data.maximum}`
        }
        this.viewer_subtitle = `Input type: ${par_text}`;
        this.create_form();
    }

    reset() {
        let form = this.form_field.form;
        if (form.querySelectorAll('.form-container').length > 3) {
            form.removeChild(document.getElementById(`div-${this.id}-min`));
            form.removeChild(document.getElementById(`div-${this.id}-max`));
        }
        super.reset();
        // form.reset();
        // form.classList.remove('was-validated');
    }

    manage_min_max(format) {
        // Add or remove the fields to set minimum and maximum value when input is numeric
        let has_values = Object.keys(this.values).indexOf('minimum') > -1;

        let min_id = `${this.id}-min`;
        let max_id = `${this.id}-max`;

        if (format == "integer" | format == 'float') {
            this.form_field.add_input("Minimum", min_id,
                {
                    placeholder: '0',
                    value: has_values ? this.values.minimum : false,
                    validation_message: "This field is compulsory and the value must be lower than the maximum."
                });
            this.form_field.form.querySelector('#' + min_id).type = 'number';

            this.form_field.add_input("Maximum", max_id,
                {
                    placeholder: '100',
                    value: has_values ? this.values.maximum : false,
                    validation_message: "This field is compulsory and the value must be lower than the minimum."
                });
            this.form_field.form.querySelector('#' + max_id).type = 'number';
            let min_button = this.form_field.form.querySelector('#'  + min_id)
            let max_button = this.form_field.form.querySelector('#'  + max_id)
            
            if (format == 'float') {
                min_button.setAttribute('step', 'any');
                max_button.setAttribute('step', 'any');
            }

            min_button.addEventListener('change', () => {
                max_button.min = min_button.value;
            });
            max_button.addEventListener('change', () => {
                min_button.max = max_button.value;
            })
        } else {
            if (this.form_field.form.querySelectorAll('.form-container').length > 3) {
                this.form_field.form.removeChild(document.getElementById(`div-${min_id}`));
                this.form_field.form.removeChild(document.getElementById(`div-${max_id}`));
            }
            if (has_values) {
                delete this.values.minimum;
                delete this.values.maximum;
            }
        }
    }

    create_form() {
        this.setup_form();
        let text_options = ["text", "textarea", "date", "email", "time", "url", "integer", "float"];
        this.form_field.add_select("Text type", `${this.id}-format`, text_options, this.type);
        this.manage_min_max(this.type);
        this.form_field.form.querySelector(".form-select").addEventListener('change', () => {
            let selected = this.form_field.form.elements[`${this.id}-format`].value;
            this.manage_min_max(selected)
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
            par_text = `${this.type} between ${this.values.minimum} and ${this.values.maximum}`
        }
        this.viewer_subtitle = `Input type: ${par_text}`;
    }

}

class ObjectInput extends InputField {
    constructor(schema_name) {
        super(schema_name);
        this.form_type = "object";
        this.button_title = "Object";
        this.dummy_title = "";
        this.description = "This can contain any combination of the previous form elements.<br>"
    }

    ex_input() {
        let inner_input = document.createElement("p");
        return inner_input;
    }

    create_editor() {
        this.editor = new ObjectEditor(this.form_field.form.id, this);
        // this.editor.modal = this.modal;
        this.editor.display_options("objectTemplates");
    }

    viewer_input() {
        return ComplexField.create_viewer(this.editor);
    }

    create_form() {
        this.setup_form();
        this.create_editor();
        this.form_field.form.appendChild(this.editor.button);
        this.end_form();
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
        this.editor.name = this.form_field.form
            .querySelector(`[name="${this.editor.id_field}"]`)
            .value;
        let json = Object.values(this.editor.to_json())[0];
        json.title = this.title;
        if (this.required) json.required = this.required;
        if (this.repeatable) json.repeatable = this.repeatable;
        return json;
    }

    from_json(data) {
        super.from_json(data);
        this.create_form();
        this.editor.from_json(data);
        this.form_field.form
            .querySelector(`[name="${this.editor.id_field}"]`)
            .value = this.editor.name;
    }
}

class MultipleInput extends InputField {
    constructor(schema_name) {
        super(schema_name);
        this.type = "select";
        this.values.values = [];
    }

    repeatable = false;
    
    ex_input() {
        let columns = Field.quick('div', 'row');
        let dropdown = Field.dropdown(this.values.multiple);
        let radio = Field.checkbox_radio(this.values.multiple);
        let col1 = Field.quick('div', 'col-6');
        col1.appendChild(dropdown);
        let col2 = Field.quick('div', 'col-6');
        col2.appendChild(radio);
        columns.appendChild(col1);
        columns.appendChild(col2);
        return columns;
    }

    viewer_input() {
        let div = this.values.ui == 'dropdown' ?
            Field.dropdown(this.values.multiple, this.values.values) :
            Field.checkbox_radio(this.values.multiple, this.values.values);
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
        this.values = { 'values' : data.values, 'multiple' : data.multiple, 'ui' : data.ui };
        this.create_form();
    }
}

// The classes above can probably be removed
class SelectInput extends MultipleInput {
    constructor(schema_name) {
        super(schema_name);
        this.form_type = "selection";
        this.button_title = "Select input";
        this.values.multiple = false;
        this.values.ui = 'radio';
    }
    dropdown_alt = 'radio';

}

class CheckboxInput extends MultipleInput {
    constructor(schema_name) {
        super(schema_name);
        this.form_type = "checkbox";
        this.button_title = "Checkboxes";
        this.values.multiple = true;
        this.values.ui = 'checkbox';
    }
    dropdown_alt = 'checkbox';

}
