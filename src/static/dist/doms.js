// for now this is just utilities for fields
class Field {
    static quick(tag, class_name, inner = null) {
        let el = document.createElement(tag);
        el.className = class_name;
        if (inner != null) {
            el.innerHTML = inner;
        }
        return el;
    }

    static example_values = ['A', 'B', 'C'];

    static dropdown(field, active = false) {
        let { multiple, values } = field.values;
        let inner_input = Field.quick("select", "form-select");
        if (multiple) {
            inner_input.setAttribute('multiple', '');
        }
        values = values ? values : Field.example_values;
        // inner_input.setAttribute("multiple", "");
        if (active) {
            let empty_option = document.createElement("option");
            inner_input.appendChild(empty_option);
        }

        for (let i of values) {
            let new_option = document.createElement("option");
            new_option.value = i;
            new_option.innerHTML = i;
            inner_input.appendChild(new_option);
        }
        if (active) {
            inner_input.name = field.name;
            if (field.required) {
                inner_input.setAttribute('required', '');
            }
            let value = Field.include_value(field);
            if (value != undefined) {
                inner_input.querySelector(`option[value="${value}"]`)
                    .setAttribute('selected', '');
            }
        }
        return inner_input;
    }

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
            new_input.name = field.name;
            if (active) {
                if (value && value.indexOf(i) > -1) {
                    new_input.setAttribute('checked', '');
                }
            }

            let new_label = Field.quick('label', "form-check-label", i);
            new_label.setAttribute("for", `check-${i}`);

            new_option.appendChild(new_input);
            new_option.appendChild(new_label);
            inner_input.appendChild(new_option);
        }
        return inner_input;
    }

    static labeller(label_text, input_id) {
        let label = Field.quick("label", "form-label h6", label_text);
        label.id = `label-${input_id}`;
        label.setAttribute("for", input_id);

        return label;
    }

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
class MovingField {
    // Parent class for a form element that can move around
    // to use in the design of multiple choice elements and to view form fields of a schema

    constructor(idx) {
        // Each field will have an id and a label / title
        // This creates a div with, a label and three buttons: up, down and remove
        this.idx = idx;
        this.up = this.add_btn('up', 'arrow-up-circle', () => this.move_up());
        this.down = this.add_btn('down', 'arrow-down-circle', () => this.move_down());
    }

    add_btn(className, symbol, action = false) {
        // Method to create a button, e.g. up, down, remove and edit
        let button_color = this.constructor.name == 'MovingViewer' ? 'btn-outline-primary' : 'btn-primary'
        let btn = Field.quick('button', `btn ${button_color} mover ${className}`);
        btn.id = `${className}-${this.idx}`;
        if (action) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                action();
            });
        }

        let icon = Field.quick('i', `bi bi-${symbol}`);
        btn.appendChild(icon);
        return btn;
    }

}

class MovingViewer extends MovingField {
    // Specific class for viewing fields of a schema
    constructor(form, schema) {
        super(form.id);
        this.rem = this.add_btn('rem', 'trash', () => this.remove());
        this.title = form.required ? form.title + '*' : form.title;
        this.repeatable = form.repeatable;
        this.div = Field.quick("div", "card border-primary viewer");
        this.div.id = form.id;
        this.body = form.viewer_input();
        let modal_id = `mod-${form.id}-${form.schema_name}-${form.schema_status}`;
        let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(modal_id));
        this.copy = this.add_btn('copy', 'front', () => this.duplicate(form));
        if (form.schema_status.startsWith('object')) {
            this.parent_modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(schema.card_id));
        }
        this.edit = this.add_btn('edit', 'pencil', () => {
            if (this.parent_modal) {
                this.parent_modal.toggle();
            }
            modal.toggle();
        });
        if (form.is_duplicate) {
            this.copy.setAttribute('disabled', '');
            // this.edit.classList.replace('btn-outline-primary', 'btn-primary');
            this.edit.classList.add('shadow');
        }

        this.assemble();
        this.schema = schema;
    }

    duplicate(form) {
        const clone = new form.constructor(this.schema.initial_name, form.schema_status);
        if (form.copies) {
            form.copies += 1;
        } else {
            form.copies = 1;
        }
        clone.id = `${form.id}-copy${form.copies}`;
        clone.title = form.title;
        clone.is_duplicate = true;
        clone.required = form.required;
        clone.repeatable = form.repeatable;
        clone.values = { ...form.values };
        clone.type = form.type;
        clone.default = form.default;
        clone.viewer_subtitle = form.viewer_subtitle;
        clone.mode = 'mod';
        clone.create_form();
        clone.create_modal(this.schema);
        if (form.constructor.name == 'ObjectInput') {
            clone.editor.field_ids = [...form.editor.field_ids];
            clone.editor.fields = { ...form.editor.fields };
            clone.editor.field_ids.forEach((field_id, idx) => {
                clone.editor.new_field_idx = idx;
                clone.editor.view_field(clone.editor.fields[field_id]);
            });
        }

        this.schema.new_field_idx = this.schema.field_ids.indexOf(form.id) + 1;
        this.schema.add_field(clone);

    }

    assemble() {
        let header = Field.quick('div', 'card-header mover-header');
        let header_title = document.createElement('h5');
        header_title.innerHTML = this.title;
        if (this.repeatable) {
            header_title.appendChild(Field.quick('i', 'bi bi-front px-2'));
        }

        let header_buttons = Field.quick('div', 'btn-list');
        for (let button of [this.up, this.down, this.copy, this.edit, this.rem]) {
            header_buttons.appendChild(button);
        }
        header.appendChild(header_title);
        header.appendChild(header_buttons);

        let body = Field.quick('div', 'card-body');
        body.appendChild(this.body);

        this.div.appendChild(header);
        this.div.appendChild(body);

    }

    move_down() {
        // Method to move a viewing field downwards
        // It has an edit button and no working input field
        // The "input field" (with no effect) depends on the kind of field
        // this.below is defined in schema.js as the 'add element' button below it
        let form_index = this.schema.field_ids.indexOf(this.idx);
        let sibling = this.below.nextSibling; // element under the bottom button
        let sibling_button = sibling.nextSibling; // button under the bottom button

        this.div.parentElement.insertBefore(sibling, this.div);
        this.div.parentElement.insertBefore(sibling_button, this.div);
        if (!sibling.previousSibling.previousSibling.classList.contains("viewer")) {
            // if the other div went to first place        
            sibling.querySelector(".up").setAttribute("disabled", "");
            this.up.removeAttribute("disabled");
        }
        if (!this.below.nextSibling.classList.contains("viewer")) {
            // if this dev went to the last place
            sibling.querySelector(".down").removeAttribute("disabled");
            this.down.setAttribute("disabled", "")
        }

        this.schema.field_ids.splice(form_index, 1);
        this.schema.field_ids.splice(form_index + 1, 0, this.idx);
    }

    move_up() {
        // Method to move a viewing field upwards
        let form_index = this.schema.field_ids.indexOf(this.idx);
        let sibling = this.div.previousSibling.previousSibling;
        this.div.parentElement.insertBefore(this.div, sibling);
        this.div.parentElement.insertBefore(this.below, sibling);
        if (!this.div.previousSibling.previousSibling.classList.contains("viewer")) {
            // if this div went to first place
            this.up.setAttribute("disabled", "");
            sibling.querySelector(".up").removeAttribute("disabled");
        }
        if (!sibling.nextSibling.nextSibling.classList.contains("viewer")) {
            // if we were in the last place
            this.down.removeAttribute("disabled");
            sibling.querySelector(".down").setAttribute("disabled", "")
        }
        this.schema.field_ids.splice(form_index, 1);
        this.schema.field_ids.splice(form_index - 1, 0, this.idx);
    }

    remove() {
        if (this.parent_modal) {
            this.parent_modal.toggle();
        }
        Modal.ask_confirmation('Deleted fields cannot be recovered.', () => {
            // Method to remove a viewing field (and thus also the field itself)
            let form_index = this.schema.field_ids.indexOf(this.idx);
            
            if (this.schema.field_ids.length > 1) {
                if (this.idx == this.schema.field_ids.length - 1) {
                    // if this is the last option
                    this.div.previousSibling.previousSibling.querySelector(".down").setAttribute("disabled", "");
                }
                if (this.idx == 0) {
                    // if this was the first option
                    this.below.nextSibling.querySelector(".up").setAttribute("disabled", "");
                }    
            }

            this.div.parentNode.removeChild(this.below);
            this.div.parentNode.removeChild(this.div);
            this.schema.field_ids.splice(form_index, 1);
            delete this.schema.fields[this.idx];
            this.schema.toggle_saving();
            if (this.parent_modal) {
                if (!document.querySelector(`.modal#${this.schema.card_id}`).classList.contains('show')) {
                    this.parent_modal.toggle();
                }
            }
        }, () => {
            console.log('dismissed')
            if (this.parent_modal) {
                if (!document.querySelector(`.modal#${this.schema.card_id}`).classList.contains('show')) {
                    this.parent_modal.toggle();
                }
            }
        });
    }

}

class MovingChoice extends MovingField {
    // Specific class for multiple choice editor
    // It has a working text input field and no edit button
    constructor(label_text, idx, value = false) {
        super(idx);
        this.rem = this.add_btn('rem', 'trash', () => this.remove());
        this.label = Field.labeller(label_text, `mover-${idx}`);
        this.div = Field.quick("div", "blocked");
        this.value = value;
        this.div.id = `block-${idx}`;
        this.input_tag = this.add_input();
        this.sub_div = Field.quick("div", "form-field");
        this.assemble();
    }

    assemble() {
        // General method to add label, remove button and others to the main div
        this.sub_div.appendChild(this.input_tag);
        this.sub_div.appendChild(this.up);
        this.sub_div.appendChild(this.down);
        this.sub_div.appendChild(this.rem);
        this.div.appendChild(this.label);
        this.div.appendChild(this.sub_div);
    }

    add_input() {
        // Method to create and add the text input field
        let input_tag = Field.quick("input", "form-control mover");
        input_tag.id = `mover-${this.idx}`;
        input_tag.name = `mover-${this.idx}`;
        input_tag.setAttribute('required', '');
        if (this.value) {
            input_tag.value = this.value;
        }
        return input_tag
    }

    move_down() {
        // Method to move the field down
        let sibling = this.div.nextSibling;
        this.div.parentElement.insertBefore(sibling, this.div);
        if (sibling.previousSibling.className !== "blocked") {
            // if the other div went to first place
            sibling.querySelector(".up").setAttribute("disabled", "");
            this.up.removeAttribute("disabled");
        }
        if (this.div.nextSibling.className !== "blocked") {
            // if this dev went to the last place
            sibling.querySelector(".down").removeAttribute("disabled");
            this.down.setAttribute("disabled", "")
        }
    }

    move_up() {
        // Method to move the field up
        let sibling = this.div.previousSibling;
        this.div.parentElement.insertBefore(this.div, sibling);
        if (this.div.previousSibling.className !== "blocked") {
            // if this div went to first place
            this.up.setAttribute("disabled", "");
            sibling.querySelector(".up").removeAttribute("disabled");
        }
        if (sibling.nextSibling.className !== "blocked") {
            // if we were in the last place
            this.down.removeAttribute("disabled");
            sibling.querySelector(".down").setAttribute("disabled", "")
        }
    }

    static remove_div(div) {
        // static method to remove a div element
        // (because this is also called programmatically to reset the form)
        if (div.nextSibling.classList.contains('mover')) {
            // if this is the last option
            div.previousSibling.querySelector(".down").setAttribute("disabled", "");
        }
        if (div.previousSibling.classList.contains('form-container')) {
            // if this was the first option
            div.nextSibling.querySelector(".up").setAttribute("disabled", "");
        }

        let existing_children = div.parentElement.querySelectorAll(".blocked");
        if (existing_children.length <= 3) {
            console.log('too few children')
            existing_children.forEach((child) => {
                child.querySelector(".rem").setAttribute("disabled", "");
            });
        }
        div.parentNode.removeChild(div);
    }

    remove() {
        // Method to remove the field when clicking on the remove button
        MovingChoice.remove_div(this.div);
    }

}
// create a DOM object that is a form and has elements
class BasicForm {
    constructor(id) {
        this.form = Field.quick("form", "m-3 needs-validation");
        this.form.id = `form-${id}`;
        this.form.setAttribute('novalidate', '')
        this.option_indices = [];

        this.divider = document.createElement('hr');
        this.form.appendChild(this.divider);
        this.rowsub = Field.quick('div', 'row justify-content-between');
        this.rowsub.id = 'submitters';
        this.form.appendChild(this.rowsub);
    }

    add_input(label_text, input_id, {
        description = false, placeholder = "Some text",
        value = false, validation_message = "This field is compulsory",
        pattern = ".*", required = true
    } = {}) {
        // Create and append a required text input
        let input_tag = Field.quick("input", "form-control");
        input_tag.id = input_id;
        input_tag.name = input_id;
        input_tag.type = "text";
        input_tag.pattern = pattern;
        input_tag.placeholder = placeholder;
        if (required) {
            input_tag.setAttribute("required", "");
        }
        if (value) {
            input_tag.value = value;
        }
        let label = Field.labeller(label_text, input_id)

        let validator = Field.quick('div', 'invalid-feedback', validation_message);

        let input_div = Field.quick('div', 'mb-3 form-container');
        input_div.id = 'div-' + input_id;
        input_div.appendChild(label);
        input_div.appendChild(input_tag);

        if (description) {
            let input_desc = Field.quick('div', 'form-text', description);
            input_desc.id = 'help-' + input_id;
            input_tag.setAttribute('aria-describedby', 'help-', input_id)
            input_div.appendChild(input_desc);
        }

        input_div.appendChild(validator);

        if (this.switches) {
            this.form.insertBefore(input_div, this.switches);
        } else {
            this.form.insertBefore(input_div, this.divider);
        }
    }

    add_select(label_text, select_id, options, selected = false) {
        // Create an append a selection object
        let select = Field.quick("select", "form-select");
        select.ariaLabel = "Select typing input type"
        select.id = select_id;
        select.name = select_id;
        if (!selected) {
            selected = options[0];
        }

        options.forEach((option) => {
            let new_option = document.createElement("option");
            new_option.value = option;
            new_option.innerHTML = option;
            if (option == selected) {
                new_option.setAttribute("selected", "")
            }
            select.appendChild(new_option);
        });

        let input_div = Field.quick('div', 'mb-3 form-container');
        input_div.appendChild(Field.labeller(label_text, select_id));
        input_div.appendChild(select);
        // this.form.appendChild(input_div);
        this.form.insertBefore(input_div, this.divider);
    }

    add_mover(label_text, idx, value = false) {
        // Create a moving field for the selection editor
        let input = new MovingChoice(label_text, idx, value).div;
        if (idx < 2) {
            input.querySelector(".rem").setAttribute("disabled", "");
        }
        this.option_indices.push(idx);
        return input;
    }

    add_moving_options(label_text, starting_values = []) {
        // List the first two moving fields (or existing fields) in the selection editor
        // And with a plus button to keep adding
        let options = starting_values;
        let has_values = options.length > 0;
        if (!has_values) {
            options = [0, 1];
        }

        for (let i in options) {
            let input = this.add_mover(label_text, i,
                has_values ? options[i] : false);
            if (options.length > 2) {
                input.querySelector('.rem').removeAttribute('disabled');
            }
            if (i == 0) {
                input.querySelector(".up").setAttribute("disabled", "");
            }
            if (i == options.length - 1) {
                input.querySelector(".down").setAttribute("disabled", "");
            }
            this.form.insertBefore(input, this.divider);
        }

        let plus_div = Field.quick('div', 'd-grid gap-2 mover mt-2');
        let plus = Field.quick("button", "btn btn-primary btn-sm", "Add option");
        plus.type = "button";
        plus.id = 'add-mover';
        plus.addEventListener('click', (e) => {
            e.preventDefault();
            let current_max = Math.max(...this.option_indices);

            let new_input = this.add_mover(label_text, current_max + 1);
            new_input.querySelector(".down").setAttribute("disabled", "");

            this.form.insertBefore(new_input, plus.parentNode);
            new_input.previousSibling.querySelector(".down").removeAttribute("disabled");

            let existing_children = this.form.querySelectorAll(".blocked");
            if (existing_children.length >= 2) {
                existing_children.forEach((child) => {
                    child.querySelector(".rem").removeAttribute("disabled");
                }
                );
            }
        });
        plus_div.appendChild(plus);

        //    this.form.appendChild(plus_div);
        this.form.insertBefore(plus_div, this.divider);
    }

    add_switches(id, switchnames = ['required', 'repeatable'],
        { required = false, repeatable = false, dropdown = false } = {}) {
        // Add a radio switch to select a field as required
        // I'm adding the radio switch for "repeatable" and "dropdown" here as well
        // For multiple choice fields, add 'dropdown' to switchnames and the Object.
        this.switches = Field.quick("div", "col-3 mt-2");
        this.switches.id = 'switches-div';
        let subdiv = Field.quick("div", "form-check form-switch form-check-inline");

        let switches = {
            'required': { 'id': 'required', 'text': 'Required', 'value': required },
            'repeatable': { 'id': 'repeatable', 'text': 'Repeatable', 'value': repeatable },
            'dropdown': { 'id': 'dropdown', 'text': 'As dropdown', 'value': dropdown }
        }

        for (let sname of switchnames) {
            let sw = switches[sname];
            let label = Field.quick("label", "form-check-label", sw.text);
            label.id = `label-${id}-${sw.id}`;
            label.setAttribute('for', `${sw.id}-${id}`);

            let input = Field.quick("input", "form-check-input");
            input.type = "checkbox";
            input.role = "switch"
            input.id = `${id}-${sw.id}`;
            if (sw.value) {
                input.setAttribute('checked', '');
            }

            subdiv.appendChild(label);
            subdiv.appendChild(input);
        }

        this.switches.appendChild(subdiv);
        this.form.insertBefore(this.switches, this.divider);
        // this.form.appendChild(div);
    }

    add_action_button(text, id = 'draft', color = 'success') {
        let div = Field.quick("div", "col-auto mt-3");
        let button = Field.quick("button", "btn btn-" + color, text);
        button.id = id;
        button.type = "submit";
        div.appendChild(button);
        this.rowsub.appendChild(div);
    }

    add_submit_action(id, action) {
        this.form.querySelector("[type='submit']#" + id)
            .addEventListener('click', action);
    }

    reset() {
        this.form.reset();
        let checkboxes = this.form.querySelectorAll('[type="checkbox"]');
        for (let checkbox of checkboxes) {
            checkbox.removeAttribute('checked');
        }
        this.form.classList.remove('was-validated');
    }

}

class SchemaDraftForm extends BasicForm {
    constructor(schema) {
        super(`${schema.card_id}-${schema.data_status}`);
        this.form.setAttribute('action', schema.urls.new);
        this.form.setAttribute('method', 'POST');
        const inputs = {
            'realm' : realm,
            'current_version' : schema.version,
            'raw_schema' : '',
            'with_status' : schema.status,
            'parent' : schema.parent ? schema.parent : ''
        }
        for (let i of Object.entries(inputs)) {
            this.add_hidden_field(i[0], i[1]);
        }
    }

    add_hidden_field(name, value) {
        const hidden_input = document.createElement('input');
        hidden_input.type = 'hidden';
        hidden_input.name = name;
        hidden_input.value = value;
        this.form.appendChild(hidden_input);
    }

    update_field(name, value) {
        this.form.querySelector(`input[name="${name}"]`).value = value;
    }
}

// create a modal - needs both the constructor and .create_modal()
class Modal {
    constructor(modal_id, header_title, header_id) {
        this.id = modal_id;
        this.header_title = header_title;
        this.header_id = header_id;
    }

    create_header() {
        let modal_header = Field.quick("div", "modal-header");

        let modal_title = Field.quick("h5", "modal-title", this.header_title, this.header_id);

        let modal_close = Field.quick("button", "btn-close");
        modal_close.setAttribute("data-bs-dismiss", "modal");
        modal_close.ariaLabel = "Close";
        modal_header.appendChild(modal_title);
        modal_header.appendChild(modal_close);

        return modal_header;
    }

    create_body(body_contents) {
        // content has to be a node to append
        let modal_body = Field.quick("div", "modal-body");
        body_contents.forEach((x) => modal_body.appendChild(x));

        return modal_body;
    }

    create_footer() {
        let modal_footer = Field.quick("div", "modal-footer");

        let footer_close = Field.quick("button", "btn btn-secondary", "Cancel");
        footer_close.type = "button";
        footer_close.setAttribute("data-bs-dismiss", "modal");

        // let footer_save = Field.quick("button", "btn btn-primary submit", "Submit");
        // footer_save.type = "button";

        modal_footer.appendChild(footer_close);
        // modal_footer.appendChild(footer_save);

        return modal_footer;
    }

    create_modal(body_contents, size = null) {
        let modal = Field.quick("div", "modal");
        modal.id = this.id;
        modal.tabIndex = "-1";
        modal.role = "dialog";

        let modal_dialog = Field.quick("div", size == null ? "modal-dialog" : `modal-dialog modal-${size}`);

        let modal_content = Field.quick("div", "modal-content");

        let modal_header = this.create_header();

        let modal_body = this.create_body(body_contents);

        let modal_footer = this.create_footer();

        modal_content.appendChild(modal_header);
        modal_content.appendChild(modal_body);
        modal_content.appendChild(modal_footer);

        modal_dialog.appendChild(modal_content);
        modal.appendChild(modal_dialog);

        document.querySelector("body").appendChild(modal);
    }

    static ask_confirmation(body, action, dismiss) {
        let conf_modal = document.querySelector('div.modal#confirmation-dialog');
        let modal = bootstrap.Modal.getOrCreateInstance(conf_modal);
        conf_modal.querySelector('p#confirmation-text')
            .innerHTML = body;
        let action_btn = conf_modal.querySelector('button#action')
        action_btn.type = 'button';
        action_btn.addEventListener('click', () => {
                action();
                modal.hide();
            });
        conf_modal.querySelector('button[data-bs-dismiss="modal"]')
            .addEventListener('click', () => {
                if (dismiss != undefined) {
                    dismiss();
                } else {
                    return;
                }
            });
        modal.show();
    }
    static submit_confirmation(body, url, form_data, extra_action) {
        let conf_modal = document.querySelector('div.modal#confirmation-dialog');
        conf_modal.querySelector('button#action').type = 'submit';
        let modal = bootstrap.Modal.getOrCreateInstance(conf_modal);
        conf_modal.querySelector('p#confirmation-text')
            .innerHTML = body;
        let form = conf_modal.querySelector('form');
        form.setAttribute('method', 'POST');
        form.setAttribute('action', url);
        const modal_body = form.querySelector('div.modal-body');
        for (let item of Object.entries(form_data)) {
            let hidden_input = document.createElement('input')
            hidden_input.type = 'hidden';
            hidden_input.name = item[0];
            hidden_input.value = item[1];
            modal_body.appendChild(hidden_input);
        }
        if (extra_action != undefined) {
            form.addEventListener('submit', () => {
                extra_action();
            });
        }
        modal.show();
    }

    static fill_confirmation_form(form_data) {
        const form = document.querySelector('div.modal#confirmation-dialog div.modal-body');
        console.log(form_data)
        Object.entries(form_data).forEach((item) => {
            form.querySelector(`input[name="${item[0]}"]`).value = item[1];
        });
        console.log(form);
        
    }

    static clean_confirmation() {
        let conf_modal = document.querySelector('div.modal#confirmation-dialog');
        conf_modal.querySelectorAll('input[type="hidden"]')
            .forEach((x) => x.remove());
        const form = conf_modal.querySelector('form');
        form.removeAttribute('action');
        form.removeAttribute('method');
    }

}

class AccordionItem {
    constructor(id, header_title, accordion, is_new = false) {
        this.id = id;
        this.parent = accordion;
        this.header_title = header_title;
        this.div = Field.quick('div', 'accordion-item');
        this.new = is_new;
        this.create();
    }
    create() {
        let header = Field.quick('div', 'accordion-header');
        header.id = this.id + '-header';
        let header_button = Field.quick('button', this.new ? 'btn btn-primary m-2' : 'accordion-button h4', this.header_title);
        header_button.type = 'button'
        header_button.setAttribute('data-bs-toggle', 'collapse');
        header_button.setAttribute('data-bs-target', '#' + this.id)
        header_button.ariaControls = this.id;
        header.appendChild(header_button);

        let body = Field.quick('div', 'accordion-collapse collapse');
        body.id = this.id;
        body.setAttribute('aria-labelledby', this.id + '-header');
        body.setAttribute('data-bs-parent', '#' + this.parent);
        this.card_body = Field.quick('div', 'accordion-body');
        body.appendChild(this.card_body);

        this.div.appendChild(header);
        this.div.appendChild(body);

        this.collapse = new bootstrap.Collapse(body, { toggle: false });
    }

    append(element, i = null) {
        let elements = this.card_body.childNodes;
        if (i == null || i >= elements.childNodes.length - 1) {
            this.card_body.appendChild(element);
        } else {
            this.card_body.insertBefore(element, elements[i + 1]);
        }
    }

    toggle() {
        this.collapse.toggle();
    }
}

class NavBar {
    constructor(id, extra_classes = []) {
        this.nav_bar = document.getElementById('nav-tab-' + id);
        if (this.nav_bar == null) {
            this.nav_bar = Field.quick('ul', 'nav');
            this.nav_bar.role = 'tablist';
            this.nav_bar.id = 'nav-tab-' + id;
            this.tab_content = Field.quick('div', 'tab-content');
        } else {
            this.tab_content = this.nav_bar.nextSibling;
        }
        this.id = id;
        for (let extra_class of extra_classes) {
            // pills would be called with extra_classes = ['justify-content-end', 'nav-pills']
            this.nav_bar.classList.add(extra_class)
        }

    }

    add_item(item_id, button_text, active = false, position = -1) {
        this.add_button(item_id, button_text, active, position);
        this.add_tab(item_id, active, position);
    }

    remove_item(item_id) {
        document.getElementById(`${item_id}-tab-${this.id}`).parentElement.remove();
        document.getElementById(`${item_id}-pane-${this.id}`).remove();
    }

    add_button(item_id, button_text, active, position = -1) {
        let li = Field.quick('li', 'nav-item');
        let button = document.createElement('button');
        button.className = active ? 'nav-link active' : 'nav-link';
        if (typeof button_text == 'string') {
            button.innerHTML = button_text
        } else {
            button_text.forEach((b) => button.appendChild(b));
        }
        button.id = `${item_id}-tab-${this.id}`;
        button.setAttribute('data-bs-toggle', 'tab');
        button.setAttribute('data-bs-target', `#${item_id}-pane-${this.id}`);
        button.type = 'button';
        button.role = 'tab';
        button.setAttribute('aria-controls', `${item_id}-pane-${this.id}`);
        li.appendChild(button);
        if (position != -1 && this.nav_bar.children.length > position) {
            let sibling = this.nav_bar.children[position];
            this.nav_bar.insertBefore(li, sibling);
        } else {
            this.nav_bar.appendChild(li);
        }
    }


    add_tab(item_id, active, position = -1) {
        let tab = Field.quick('div',
            active ? 'tab-pane fade show active' : 'tab-pane fade');
        tab.id = `${item_id}-pane-${this.id}`;
        tab.role = 'tabpanel';
        tab.setAttribute('aria-labelledby', `${item_id}-tab-${this.id}`);
        tab.tabIndex = '0';
        if (position != -1 && this.tab_content.children.length > position) {
            let sibling = this.tab_content.children[position];
            this.tab_content.insertBefore(tab, sibling);
        } else {
            this.tab_content.appendChild(tab);
        }
    }

    add_tab_content(item_id, content) {
        this.tab_content.querySelector(`#${item_id}-pane-${this.id}`).appendChild(content);
    }

    add_action_button(text, color, action) {
        let btn = Field.quick('button', `btn btn-outline-${color}`, text);
        let id = text.toLowerCase().replaceAll(' ', '-');
        btn.id = `${id}-${this.id}`;
        btn.type = 'button';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            action();
        });
        this.nav_bar.appendChild(btn);
    }

}

class Toast {
    constructor(id, text) {
        this.div = Field.quick('div', 'toast');
        this.div.role = 'alert';
        this.div.id = id;
        this.div.setAttribute('aria-live', 'assertive');
        this.div.setAttribute('aria-atomic', 'true');
        this.div.setAttribute('data-bs-autohide', 'false');

        let header = Field.quick('div', 'toast-header text-bg-danger');
        let question = Field.quick('strong', 'me-auto', 'Are you sure?');
        // let mango = Field.quick('small', 'text-muted', 'ManGO');
        let buttonx = Field.quick('button', 'btn-close');
        buttonx.type = 'button';
        buttonx.setAttribute('data-bs-dismiss', 'toast');
        buttonx.setAttribute('aria-label', 'Close');
        header.appendChild(question);
        // header.appendChild(mango);
        header.appendChild(buttonx);

        let body = Field.quick('div', 'toast-body', text);
        let border = Field.quick('div', 'row mt-2 pt-2 border-top justify-content-between');
        let yes = Field.quick('button', 'btn btn-primary btn-sm', "I'm sure");
        yes.name = 'yes';
        let no = Field.quick('button', 'btn btn-secondary btn-sm', 'Cancel');
        no.setAttribute('data-bs-dismiss', 'toast');
        body.appendChild(border);
        border.appendChild(yes);
        border.appendChild(no);

        this.div.appendChild(header);
        this.div.appendChild(body);

        document.querySelector('.toast-container').appendChild(this.div);

    }

    show(action) {
        const toast = new bootstrap.Toast(document.getElementById(this.div.id));
        this.div.querySelector('[name="yes"]').addEventListener('click', () => {
            action();
            toast.dispose();
        });

        toast.show();
    }
}
