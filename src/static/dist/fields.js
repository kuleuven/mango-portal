
class InputField {
    constructor() {
        this.description = ""; // description to show in the options viewer
        this.dummy_title = "Title"; // dummy title in options viewer (probably could go)
        this.type = "string"; // basic "type" when rendering the json
        this.required = false; // whether the field is required
        this.values = {}; // values to return in the json
        this.mode = 'add'; // whether the form has to be created or edited ("mod")
    }

    get form() {
        return this.create_form();
    }

    get json() {
        return this.to_json();
    }

    to_json() {
        return { title: this.title, type: this.type, ...this.values };
    }

    create_example() {
        let example = Field.quick("div", "ex", this.description);

        let inner_label = Field.quick("label", "form-label h6", this.dummy_title);

        example.appendChild(inner_label);
        example.appendChild(this.ex_input());
        return example;
    }

    render(schema) {
        this.id = `${this.form_type}-${schema.id}`;
        let new_form = Field.quick("div", "border HTMLElement rounded");

        let new_button = Field.quick("button", "btn btn-primary HTMLElementButton", this.button_title);
        this.create_modal(schema)

        new_button.setAttribute("data-bs-toggle", "modal");
        new_button.setAttribute("data-bs-target", `#add-${this.id}`);

        new_form.appendChild(new_button);
        new_form.appendChild(this.create_example());

        return new_form;
    }

    setup_form() {
        let form = new BasicForm(this.id);
        form.add_input(
            `ID for ${this.form_type}`, `${this.id}-id`,
            "Use lowercase, no spaces, no special characters other than '_'.",
            this.field_id);
        form.add_input(
            `Label for ${this.form_type}`, `${this.id}-label`,
            "Description of the input field.",
            this.title);
        return form;
    }

    end_form(form) {
        // Add require switch and submit button to form
        form.form.appendChild(document.createElement('br'));
        form.add_requirer(this.id, this.required);
        let switch_input = form.form.querySelector('.form-switch').querySelector('input');
        switch_input.addEventListener('change', () => {
            this.required = !this.required;
            this.required ? switch_input.setAttribute('checked', '') : switch_input.removeAttribute('checked');
        });
        form.add_submitter("Submit");

    }

    create_modal(schema) {
        let modal_id = `${this.mode}-${this.id}`;
        let edit_modal = new Modal(modal_id, `Add ${this.button_title}`, `title-${this.form_type}`);
        edit_modal.create_modal([this.form], 'lg');
        this.modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(modal_id));
        let modal = document.getElementById(`${this.mode}-${this.id}`);
        let form = modal.querySelector(`#form-${this.id}`)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add('was-validated');
            } else {
                this.register_fields(schema, form);
                form.classList.remove('was-validated');
                this.modal.toggle();
                // let parent_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(schema.modal_id));
                // parent_modal.toggle();
            }
        }, false);
    }

    register_fields(schema, form) {
        // Read data from the modal form
        // With this form we create a new instance of the class with the output of the form
        // and give it to the schema as a created field
        // Then we reset this form so we can create more fields
        let data = new FormData(form);
        let old_id = this.id;
        let new_id = data.get(`${this.id}-id`);
        if (old_id == new_id) {
            this.title = data.get(`${this.id}-label`);
            this.recover_fields(data);
            schema.update_field(this);
        } else {
            let clone = new this.constructor(this.parent_modal);
            clone.field_id = new_id;
            clone.title = data.get(`${this.id}-label`);

            clone.required = this.required;
            this.required = false;

            clone.id = this.id // temporarily, to recover data
            clone.viewer_title = clone.title;
            clone.recover_fields(data);
            clone.viewer_title = clone.form_type === "text" ? clone.viewer_title : clone.title;
            clone.id = clone.field_id;
            this.reset(form); // specific

            if (this.mode == 'mod') {
                schema.replace_field(old_id, clone);
            } else {
                clone.mode = 'mod';
                schema.add_field(clone);
                clone.create_modal(schema);
            }
        }
    }
    view(schema) {
        // Method to view the created form
        return new MovingViewer(this, schema);
    }

    reset(form) {
        form.reset();
    }
}


class TypedInput extends InputField {
    constructor() {
        super();
        this.form_type = "text";
        this.button_title = "Text input";
        this.description = "Text options: regular text, number, date, time, e-mail or URL.<br>"
        this.values = { format: "text" };
    }

    ex_input() {
        let inner_input = Field.quick("input", "form-control");
        inner_input.placeholder = "example placeholder";
        return inner_input;
    }

    viewer_input() {
        let input;
        if (this.values.format != 'text box') {
            input = Field.quick("input", "form-control input-view");
            input.type = this.values.format;
        } else {
            input = Field.quick("textarea", "form-control input-view");
        }
        input.setAttribute('readonly', '');
        return input;
    }

    reset(form) {
        if (form.querySelectorAll('.form-container').length > 3) {
            form.removeChild(document.getElementById(`div-${this.id}-min`));
            form.removeChild(document.getElementById(`div-${this.id}-max`));
        }
        form.reset();
    }

    manage_min_max(form, format) {
        // Add or remove the fields to set minimum and maximum value when input is numeric
        let has_values = Object.keys(this.values).indexOf('minimum') > -1;
        if (format == "number") {
            form.add_input("Minimum", `${this.id}-min`, '0', has_values ? this.values.minimum : false);
            form.form.querySelector(`#${this.id}-min`).type = 'number';
            form.add_input("Maximum", `${this.id}-max`, '100', has_values ? this.values.maximum : false);
            form.form.querySelector(`#${this.id}-max`).type = 'number';
        } else {
            if (form.form.querySelectorAll('.form-container').length > 3) {
                form.form.removeChild(document.getElementById(`div-${this.id}-min`));
                form.form.removeChild(document.getElementById(`div-${this.id}-max`));
            }
            if (has_values) {
                delete this.values.minimum;
                delete this.values.maximum;
            }
        }
    }

    create_form() {
        let form = this.setup_form();
        let text_options = ["text", "text box", "date", "email", "time", "url", "number"];
        form.add_select("Text type", `${this.id}-format`, text_options, this.values.format);
        this.manage_min_max(form, this.values.format);
        form.form.querySelector(".form-select").addEventListener('change', () => {
            let selected = form.form.elements[`${this.id}-format`].value;
            this.manage_min_max(form, selected)
        });
        this.end_form(form);
        return form.form;
    }

    recover_fields(data) {
        this.values.format = data.get(`${this.id}-format`);
        let par_text = this.values.format;
        if (this.values.format === "number") {
            this.values.minimum = data.get(`${this.id}-min`);
            this.values.maximum = data.get(`${this.id}-max`);
            this.type = "number";
            par_text = `between ${this.values.minimum} and ${this.values.maximum}`
        }
        this.viewer_title = `${this.title} (${par_text})`;
    }

}
class ObjectInput extends InputField {
    constructor() {
        super();
        this.form_type = "object";
        this.button_title = "Object";
        this.dummy_title = "";
        this.description = "This can contain any combination of the previous form elements.<br>"
    }

    ex_input() {
        let inner_input = document.createElement("p");
        return inner_input;
    }

    create_form() {
        let form = this.setup_form();
        this.editor = new ObjectEditor(form);
        form.form.appendChild(this.editor.button);
        this.editor.modal = this.modal;
        this.editor.display_options("objectTemplates");

        this.end_form(form);
        return form.form;
    }

    recover_fields(data) {
        // I'm not so sure about this one...
        this.values.required = this.editor.required;
        this.values.properties = this.editor.properties;
    }

    // add_fields(basic, data) {
    //     basic.required = this.editor.required;
    //     basic.properties = this.editor.properties;
    //     return basic;
    // }
}

class MultipleInput extends InputField {
    constructor() {
        super();
    }

    create_form() {
        let form = this.setup_form();
        form.add_moving_options("Select option", this.values);
        this.end_form(form);
        return form.form;
    }

    reset(form) {
        while (form.querySelectorAll(".blocked").length > 2) {
            MovingChoice.remove_div(form.querySelector(".blocked"));
        }
        form.reset();
    }

}

class SelectInput extends MultipleInput {
    constructor() {
        super();
        this.form_type = "selection";
        this.button_title = "Select input";
        this.values.enum = [];
    }

    ex_input() {
        let inner_input = Field.quick("select", "form-select");
        // inner_input.setAttribute("multiple", "");
        for (let i = 1; i < 4; i++) {
            let new_option = document.createElement("option");
            new_option.value = `${i}`;
            new_option.innerHTML = `Option ${i}.`;
            inner_input.appendChild(new_option);
        }
        return inner_input;
    }

    viewer_input() {
        let inner_input = Field.quick("select", "form-select input-view");
        for (let option of this.values.enum) {
            let new_option = document.createElement("option");
            new_option.value = option;
            new_option.innerHTML = option;
            inner_input.appendChild(new_option);
        }
        return inner_input;
    }

    recover_fields(data) {
        for (let pair of data.entries()) {
            if (pair[0].startsWith("mover")) {
                this.values.enum.push(pair[1]);
            }
        }
    }
}

class CheckboxInput extends MultipleInput {
    constructor() {
        super();
        this.form_type = "checkbox";
        this.button_title = "Checkboxes";
        this.type = "object";
        this.values.properties = {};
    }

    ex_input() {
        let inner_input = document.createElement("div");
        for (let i = 1; i < 4; i++) {
            let new_option = Field.quick("div", "form-check input-view");

            let new_input = Field.quick("input", "form-check-input");
            new_input.type = "checkbox";
            new_input.value = i;
            new_input.id = `check-${i}`;

            let new_label = Field.quick('label', "form-check-label", `Option ${i}.`);
            new_label.setAttribute("for", `check-${i}`);

            new_option.appendChild(new_input);
            new_option.appendChild(new_label);
            inner_input.appendChild(new_option);
        }
        return inner_input;
    }

    viewer_input() {
        let inner_input = document.createElement("div");
        for (let option of Object.keys(this.values.properties)) {
            let new_option = Field.quick("div", "form-check");

            let new_input = Field.quick("input", "form-check-input");
            new_input.type = "checkbox";
            new_input.value = option;
            new_input.id = `check-${option}`;

            let new_label = Field.quick('label', "form-check-label", option);
            new_label.setAttribute("for", `check-${option}`);

            new_option.appendChild(new_input);
            new_option.appendChild(new_label);
            inner_input.appendChild(new_option);
        }
        return inner_input;
    }
    recover_fields(data) {
        for (let pair of data.entries()) {
            if (pair[0].startsWith("mover")) {
                this.values.properties[pair[1]] = {
                    type: "boolean", title: pair[1]
                }
            }
        }
    }

}

// class SwitchInput extends MultipleInput {
//     constructor() {
//         super();
//         this.form_type = "radio";
//         this.title = "Switch";
//     }

//     ex_input() {
//         let inner_input = document.createElement("div");
//         inner_input.className = "form-check form-switch";

//         let subinput = document.createElement("input");
//         subinput.className = "form-check-input";
//         subinput.type = "checkbox";
//         subinput.id = "switch-example";
//         subinput.setAttribute("checked", "");

//         let new_label = document.createElement("label");
//         new_label.className = "form-check-label";
//         new_label.setAttribute("for", "switch-example");
//         new_label.innerHTML = "On/off";

//         inner_input.appendChild(subinput);
//         inner_input.appendChild(new_label);
//         return inner_input;
//     }

// }
