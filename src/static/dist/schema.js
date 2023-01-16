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
            properties: {}
        }
        this.field_ids.forEach((field_id) => {
            let field = this.fields[field_id];
            base_data.properties[field_id] = field.json;
        });
        let json = {};
        json[this.name] = base_data;
        return json;
    }

    from_json(data) {
        this.name = data.title;
        this.field_ids = Object.keys(data.properties);
        for (let entry of Object.entries(data.properties)) {
            let new_field = InputField.choose_class(entry);
            new_field.create_modal(this);
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

    view_field(form_object) {
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
    }

    add_field(form_object) {
        // Register a created form field, add it to the fields dictionary and view it
        this.field_ids.splice(this.new_field_idx, 0, form_object.id);
        this.fields[form_object.id] = form_object;
        this.view_field(form_object);

        console.log(this.json);
    }

    update_field(form_object) {
        // TODO have checks so we don't just replace everything
        this.fields[form_object.id] = form_object;
        let viewer = document.getElementById(this.card_id).querySelector('#' + form_object.id);
        viewer.querySelector('h5').innerHTML = form_object.required ? form_object.title + '*' : form_object.title;
        let rep_icon = Field.quick('i', 'bi bi-stack');
        if (form_object.repeatable) {
            viewer.querySelector('h5').appendChild(rep_icon);
        } else if (viewer.querySelector('.bi-stack') != null) {
            viewer.querySelector('h5').removeChild(rep_icon);
        }
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
        super('objectChoice' + parent.id);
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
    constructor(card_id, container_id, url) {
        super('formChoice');
        this.card_id = card_id;
        this._name = card_id;
        this.container = container_id;
        this.url = url
    }

    get name() {
        this._name = document.getElementById(this.card_id).querySelector("#template-name").value;
        return this._name;
    }

    set name(name) {
        this._name = name;
        let form_title = document.getElementById(this.card_id);
        if (form_title != null) {
            form_title.querySelector("#template-name").value = this._name;
        }
    }

    get accordion_item() {
        return this.card.div;
    }

    create_editor() {
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
                // console.log(this.json);
                this.post();
                form.reset();
                form.form.querySelectorAll('.viewer').forEach((viewer) => {
                    viewer.nextSibling.remove();
                    viewer.remove();
                });
                form.form.classList.remove('was-validated');

                this.card.toggle();
            }            
        });
        return form;
    }

    create_creator() {
        let form = this.create_editor();
        this.card = new AccordionItem(this.card_id, 'New schema', 'metadata_template_list_container', true);
        document.getElementById(this.container).appendChild(this.accordion_item);
        this.card.append(form.form);
    }

    create_navbar() {
        // design navbar
        this.nav_bar = Field.quick('ul', 'nav justify-content-end nav-pills');
        this.nav_bar.role = 'tablist';
        this.nav_bar.id = 'pills-tab-' + this._name;
        
        let view_li = Field.quick('li', 'nav-item');
        let view_button = Field.quick('a', 'nav-link active', 'View');
        view_button.id = 'view-tab-' + this._name;
        view_button.setAttribute('data-bs-toggle', 'pill');
        view_button.setAttribute('data-bs-target', `#view-pane-${this._name}`);
        view_button.type = 'button';
        view_button.role = 'tab';
        view_button.setAttribute('aria-controls', `view-pane-${this._name}`);
        this.nav_bar.appendChild(view_li);
        view_li.appendChild(view_button);
        
        let edit_li = Field.quick('li', 'nav-item');
        let edit_button = Field.quick('a', 'nav-link', 'Edit');
        edit_button.id = 'edit-tab-' + this._name;
        edit_button.setAttribute('data-bs-toggle', 'pill');
        edit_button.setAttribute('data-bs-target', `#edit-pane-${this._name}`);
        edit_button.type = 'button';
        edit_button.role = 'tab';
        edit_button.setAttribute('aria-controls', `edit-pane-${this._name}`);
        this.nav_bar.appendChild(edit_li);
        edit_li.appendChild(edit_button);

        // design tabs
        this.tab_content = Field.quick('div', 'tab-content');
        let viewer_tab = Field.quick('div', 'tab-pane fade show active');
        viewer_tab.id = 'view-pane-' + this._name;
        viewer_tab.role = 'tabpanel';
        viewer_tab.setAttribute('aria-labelledby', 'view-tab-' + this._name);
        viewer_tab.tabIndex = '0';

        let viewer = ComplexField.create_viewer(this);
        viewer_tab.appendChild(viewer);
        
        let editor_tab = Field.quick('div', 'tab-pane fade');
        editor_tab.id = 'edit-pane-' + this._name;
        editor_tab.role = 'tabpanel';
        editor_tab.setAttribute('aria-labelledby', 'edit-tab-' + this._name);
        editor_tab.tabIndex = '0';
        
        let form = this.create_editor();
        form.form.querySelector('#template-name').value = this._name;
        editor_tab.appendChild(form.form);

        this.tab_content.appendChild(viewer_tab);
        this.tab_content.appendChild(editor_tab);

    }

    view() {
        this.card = new AccordionItem(this.card_id, this._name, 'metadata_template_list_container');
        document.getElementById(this.container).appendChild(this.accordion_item);
        this.create_navbar();
        this.card.append(this.nav_bar);
        this.card.append(this.tab_content);
        this.field_ids.forEach((field_id, idx) => {
            this.new_field_idx = idx;
            this.view_field(this.fields[field_id]);
        })
    }

    post() {
        const to_post = new FormData();
        to_post.append('template_name', this.name + ".json");
        to_post.append('template_json', JSON.stringify(this.json));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.url, true);
        xhr.send(to_post);
        console.log(this.name, ' posted.');
    }
}
