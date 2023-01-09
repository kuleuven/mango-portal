// set up and manipulate a metadata schema
class ComplexField {
    constructor(choice_id) {
        this.type = "object";
        this.choice_id = choice_id;
        this.id = Math.round(Math.random() * 100);
        this.initials = {
            typed: new TypedInput(),
            select: new SelectInput(),
            checkbox: new CheckboxInput(),
            // switch : new SwitchInput(),
            object: new ObjectInput()
        };
        this.field_ids = []; // ids of the forms as they are added
        this.fields = {}; // dictionary where forms will be added
        this._name = name;
    }

    get json() {
        return this.to_json();
    }


    to_json() {
        let base_data = {
            title: this.name,
            type: "object",
            required: [],
            properties: {}
        }
        this.field_ids.forEach((field_id) => {
            let field = this.fields[field_id];
            base_data.properties[field_id] = field.json;
            if (field.required) {
                base_data.required.push(field_id);
            }
        });
        return base_data;
    }

    from_json(data) {
        this.name = data.title;
        this.field_ids = Object.keys(data.properties);
        for (let entry of Object.entries(data.properties)) {
            let new_field = InputField.choose_class(entry);
            new_field.required = data.required.indexOf(entry[0]) > -1;
            this.fields[entry[0]] = new_field;
        }
    }

    display_options(templates_area) {
        let formTemp = Field.quick("div", "formContainer");
        formTemp.id = templates_area

        let form_choice_modal = new Modal(this.choice_id, "What form element would you like to add?", "choiceTitle");
        form_choice_modal.create_modal([formTemp], 'lg');
        let this_modal = document.getElementById(this.choice_id);
        this_modal.addEventListener('show.bs.modal', () => {
            let formTemp = this_modal.querySelector('div.formContainer');
            if (formTemp.childNodes.length == 0) {
                Object.values(this.initials).forEach((initial) => {
                    formTemp.appendChild(initial.render(this));
                });
            }
        });
    }

    add_field(form_object) {
        // Register a created form field, add it to the fields dictionary and view it
        this.field_ids.splice(this.new_field_idx, 0, form_object.id);
        this.fields[form_object.id] = form_object;
        console.log(this.card_id);

        let clicked_button = document.getElementById(this.card_id).querySelectorAll('.adder')[this.new_field_idx];
        let below = clicked_button.nextSibling;
        let moving_viewer = form_object.view(this);
        let new_button = this.create_button();

        below.parentElement.insertBefore(moving_viewer.div, below);
        below.parentElement.insertBefore(new_button, below);
        moving_viewer.below = new_button;
        let viewers = below.parentElement.querySelectorAll('.viewer');
        if (this.new_field_idx === 0) {
            moving_viewer.up.setAttribute('disabled', '');
            if (viewers.length > 1) {
                viewers[1].querySelector('.up').removeAttribute('disabled');
            }
        }
        if (this.new_field_idx === this.field_ids.length - 1) {
            moving_viewer.down.setAttribute('disabled', '');
            if (viewers.length > 1) {
                viewers[viewers.length - 2].querySelector('.down').removeAttribute('disabled');
            }
        }

        console.log(this.json);
    }

    update_field(form_object) {
        // TODO have checks so we don't just replace everything
        this.fields[form_object.id] = form_object;
        let viewer = document.getElementById(this.card_id).querySelector('#' + form_object.id);
        viewer.querySelector('h5').innerHTML = form_object.required ? form_object.title + '*' : form_object.title;
        let form_field = viewer.querySelector('.card-body');
        let new_input = form_object.viewer_input();
        form_field.replaceChild(new_input, form_field.firstChild);
        console.log(this.json);
    }

    replace_field(old_id, form_object) {
        delete this.fields[old_id];
        this.new_field_idx = this.field_ids.indexOf(old_id);
        this.field_ids.splice(this.new_field_idx, 1);
        this.add_field(form_object);
        console.log(this.json);
    }

    create_button() {
        // Create a button to create more form elements
        let div = Field.quick('div', 'd-grid gap-2 adder mt-2');
        let button = Field.quick("button", "btn btn-primary btn-sm", "Add element");
        button.type = "button";
        button.setAttribute("data-bs-toggle", "modal");
        button.setAttribute("data-bs-target", `#${this.choice_id}`);

        button.addEventListener('click', () => {
            this.new_field_idx = div.previousSibling.classList.contains('viewer') ?
            this.field_ids.indexOf(div.previousSibling.id) + 1 :
            0;
        });
        div.appendChild(button);
        return div;
    }

    static create_viewer(schema) {
        let div = Field.quick('div', 'input-view');
        schema.field_ids.forEach((field_id) => {
            let subfield = schema.fields[field_id];
            let small_div = Field.quick('div', 'mini-viewer');
            let label;
            if (subfield.constructor.name == 'ObjectInput') {
                label = Field.quick('h5', 'border-bottom border-secondary');
                label.innerHTML = subfield.required ? subfield.title + '*' : subfield.title;
                label.id = `viewer-${subfield.id}`;
                small_div.className = small_div.className + ' border border-1 border-secondary rounded p-3 my-1'
            } else {
                label = BasicForm.labeller(
                    subfield.required ? subfield.title + '*' : subfield.title,
                    `viewer-${subfield.id}`
                );
            }            
            let input = subfield.viewer_input();
            small_div.appendChild(label);
            small_div.appendChild(input);
            div.appendChild(small_div);
        });
        return div;
    }

}

class ObjectEditor extends ComplexField {
    constructor(parent_form, parent) {
        super('objectChoice');
        this.form = parent_form;
        this.card_id = `${parent.mode}-${parent.id}`;
        this.id_field = `${parent.id}-id`
    }

    get button() {
        return this.create_button();
    }

    get name() {
        let data = new FormData(this.form.form);
        this._name = data.get(this.id_field);
        return this._name;
    }
    
    set name(name) {
        this._name = name;
        return;
    }

}

class Schema extends ComplexField {
    constructor(card_id, name = null) {
        super('formChoice');
        this.card_id = card_id;
    }

    get name() {
        this._name = document.getElementById(this.card_id).querySelector("#template-name").value;
        return this._name;
    }

    set name(name) {
        this._name = name;
        let form_title = document.getElementById(this.card_id)
        if (form_title != null) {
            form_title.querySelector("#template-name").value = this._name;
        }
    }

    get accordion_item() {
        return this.card.div;
    }

    init_card() {
        this.display_options('formTemplates');
        let form = new BasicForm('schema');
        form.add_input("Metadata template name", "template-name", "first-schema");

        let button = this.create_button();
        form.form.appendChild(button);
        form.add_submitter("Save schema");

        form.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!form.form.checkValidity()) {
                e.stopPropagation();
                form.form.classList.add('was-validated');
            } else {
                // save form!
                console.log(this.json);
                form.reset();
                form.form.querySelectorAll('.viewer').forEach((viewer) => {
                    viewer.nextSibling.remove();
                    viewer.remove();
                });
                form.form.classList.remove('was-validated');

                this.card.toggle();

                // this.modal.toggle();
            }            

        });

        this.card = new AccordionItem(this.card_id, 'New schema', 'metadata_template_list_container', true);
        this.card.fill(form.form)
    }

    view() {
        this.card = new AccordionItem(this.card_id, this._name, 'metadata_template_list_container');
        this.card.fill(ComplexField.create_viewer(this));
    }
}
