// set up and manipulate a metadata schema
class ComplexField {
    constructor(choice_id, name) {
        this.type = "object";
        this.choice_id = `${choice_id}-${name}`;
        this.id = Math.round(Math.random() * 100);
        this.initials = {
            typed: new TypedInput(name),
            select: new SelectInput(name),
            checkbox: new CheckboxInput(name),
            object: new ObjectInput(name)
        };
        this.field_ids = []; // ids of the forms as they are added
        this.fields = {}; // dictionary where forms will be added
        this.initial_name = name;
        this.new_field_idx = 0;
    }

    get json() {
        return this.to_json();
    }

    reset() {
        this.field_ids = [];
        this.fields = {};
        this.new_field_idx = 0;
        this._name = 'schema-editor-schema'
    }


    to_json() {
        let base_data = {
            title: this.name,
            version: this.version,
            status: this.status,
            type: "object",
            properties: {}
        }
        this.field_ids.forEach((field_id) => {
            let field = this.fields[field_id];
            base_data.properties[field_id] = field.json;
        });
        let json = {};
        json[this._name] = base_data;
        return json;
    }

    from_json(data) {
        this._name = data.title;
        this.field_ids = Object.keys(data.properties);
        for (let entry of Object.entries(data.properties)) {
            let new_field = InputField.choose_class(data.title, entry);
            new_field.create_modal(this);
            this.fields[entry[0]] = new_field;
        }
    }

    display_options(templates_area) {
        let formTemp = Field.quick("div", "formContainer");
        formTemp.id = templates_area;

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
    }

    update_field(form_object) {
        // TODO have checks so we don't just replace everything
        this.fields[form_object.id] = form_object;
        let viewer = document.getElementById(this.card_id).querySelector('#' + form_object.id);
        viewer.querySelector('h5').innerHTML = form_object.required ? form_object.title + '*' : form_object.title;
        let rep_icon = Field.quick('i', 'bi bi-stack px-2');
        if (form_object.repeatable) {
            viewer.querySelector('h5').appendChild(rep_icon);
        } else if (viewer.querySelector('.bi-stack') != null) {
            viewer.querySelector('h5').removeChild(rep_icon);
        }
        let form_field = viewer.querySelector('.card-body');
        let new_input = form_object.viewer_input();
        form_field.replaceChild(new_input, form_field.firstChild);
    }

    replace_field(old_id, form_object) {
        delete this.fields[old_id];
        this.new_field_idx = this.field_ids.indexOf(old_id);
        this.field_ids.splice(this.new_field_idx, 1);
        this.add_field(form_object);
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
                label = Field.labeller(
                    subfield.required ? subfield.title + '*' : subfield.title,
                    `viewer-${subfield.id}`
                );
            }
            if (subfield.repeatable) {
                label.appendChild(Field.quick('i', 'bi bi-stack px-2'));
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
    constructor(form_id, parent) {
        super('objectChoice' + parent.id, parent.id + '-obj');
        this.form_id = form_id;
        this.card_id = `${parent.mode}-${parent.id}-${parent.schema_name}`;
        this.id_field = `${parent.id}-id`
    }

    get button() {
        return this.create_button();
    }

    get name() {
        let data = new FormData(document.getElementById(this.form_id));
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
        super('formChoice', card_id);
        this.card_id = card_id + '-schema';
        this._name = card_id;
        this.container = container_id;
        this.url = url
    }

    get name() {
        this._name = document.getElementById(this.card_id).querySelector(`#${this.card_id}-name`).value;
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
        let form = new BasicForm(this.card_id);
        form.add_input("Metadata template name", this.card_id + '-name', {
            placeholder : "schema-name", validation_message: "This field is compulsory, please only use lower case letters and '-'.",
            pattern: "[a-z0-9-]+"
        });

        let button = this.create_button();
        form.form.appendChild(button);
        form.add_submitter("Save schema")
        form.add_submit_action((e) => {
            e.preventDefault();
            if (!form.form.checkValidity()) {
                e.stopPropagation();
                form.form.classList.add('was-validated');
            } else {
                // save form!
                let json_contents = this.json;
                this.post(json_contents);
                if (this.card_id == 'schema-editor-schema') {
                    // this was newly created
                    form.reset();
                    form.form.querySelectorAll('.viewer').forEach((viewer) => {
                        viewer.nextSibling.remove();
                        viewer.remove();
                    });

                    let new_schema = new Schema(this._name, this.container, this.url);
                    new_schema.from_json(Object.values(json_contents)[0]);
                    new_schema.view();

                    this.reset();
                    this.card.toggle();
                } else {
                    // this schema was modified
                    let trigger = document.querySelector(`#pills-tab-${this._name} button`);
                    bootstrap.Tab.getOrCreateInstance(trigger).show();
                    let old_input_view = document.querySelector(`#view-pane-${this._name}`).querySelector('.input-view');
                    let new_input_view = ComplexField.create_viewer(this);
                    old_input_view.parentElement.replaceChild(new_input_view, old_input_view);
                    // and what if the name changed?
                }
                form.form.classList.remove('was-validated');
                
            }            
        });
        return form;
    }

    create_creator(version) {
        this.status = 'draft';
        this.version = version;
        let form = this.create_editor();
        this.card = new AccordionItem(this.card_id, 'New schema', this.container, true);
        document.getElementById(this.container).appendChild(this.accordion_item);
        this.card.append(form.form);
    }

    create_navbar() {
        // design navbar
        let nav_bar = new NavBar(this._name, ['justify-content-end', 'nav-pills']);
        nav_bar.add_item('view', 'View', true);

        let viewer = ComplexField.create_viewer(this);
        nav_bar.add_tab_content('view', viewer);
        
        if (this.status == 'draft') {
            nav_bar.add_item('edit', 'Edit');

            let form = this.create_editor();
            form.form.querySelector('input.form-control').value = this._name;
            nav_bar.add_tab_content('edit', form.form);

            nav_bar.add_item('discard', 'Discard');
        } else if (this.status == 'published') {
            nav_bar.add_item('new', 'New version');
            nav_bar.add_item('child', 'Create child');
            nav_bar.add_item('archive', 'Archive')
        }
        
        this.nav_bar = nav_bar.nav_bar;
        this.tab_content = nav_bar.tab_content;

    }

    view() {
        console.log('This is version', this.version, 'of', this._name, 'which has status:', this.status);

        this.create_navbar();
        this.card = document.createElement('div')        
        this.card.id = this.card_id;
        this.card.appendChild(this.nav_bar);
        this.card.appendChild(this.tab_content);
        document.getElementById(this.container).appendChild(this.card);

        this.field_ids.forEach((field_id, idx) => {
            this.new_field_idx = idx;
            if (this.status == 'draft') {
                this.view_field(this.fields[field_id]);
            }
        })
    }

    post(json_contents) {
        const to_post = new FormData();
        to_post.append('template_name', this._name);
        to_post.append('template_json', JSON.stringify(json_contents));
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.url, true);
        xhr.send(to_post);
        console.log(this._name, 'posted.');
    }
}

class SchemaGroup {
    badge_url = 'https://img.shields.io/badge/';
    status_colors = {
        'published' : 'success',
        'draft' : 'orange',
        'archived' : 'inactive'
    }

    constructor(template, container_id) {
        this.name = template.schema_name;
        this.versions = template.template_list.map((temp) => {
            let temp_info = temp.name.split('-v')[1].split('-');
            let status = temp_info[1].startsWith('draft') ? 'draft' : temp_info[1].startsWith('published') ? 'published' : 'archived';
            let data = {
                version : temp_info[0],
                status : status
            }
            return(data);
        });

        let nav_bar = new NavBar(this.name, ['nav-tabs']);
        let statuses = this.versions.map((v) => v.status);

        for (let version of this.versions) {
            let version_badge = document.createElement('img');
            version_badge.setAttribute('alt', 'version ' + version.version);
            version_badge.setAttribute('src', `${this.badge_url}version-${version.version}-blue`);

            let status_badge = Field.quick('img', 'mx-2');
            status_badge.setAttribute('alt', 'status ' + version.status);        
            status_badge.setAttribute('src', `${this.badge_url}-${version.status}-${this.status_colors[version.status]}`);

            let active = statuses.indexOf('published') > -1 ? version.status == 'published' : version.status == 'draft';
            // this does not account for a case with only archived versions and a draft
            nav_bar.add_item(`v${version.version.replaceAll('.', '')}`, [version_badge, status_badge], active);
        };

        let acc_item = new AccordionItem(this.name + '-schemas', this.name, container_id);
        acc_item.append(nav_bar.nav_bar);
        acc_item.append(nav_bar.tab_content);
        document.getElementById(container_id).appendChild(acc_item.div);
    }
}
