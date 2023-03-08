// set up and manipulate a metadata schema
class ComplexField {
    constructor(choice_id, name, data_status = 'draft') {
        this.type = "object";
        this.choice_id = `${choice_id}-${name}`;
        this.id = Math.round(Math.random() * 100);
        this.data_status = data_status;
        this.initials = {
            typed: new TypedInput(name, this.data_status),
            select: new SelectInput(name, this.data_status),
            checkbox: new CheckboxInput(name, this.data_status),
            object: new ObjectInput(name, this.data_status)
        };
        this.field_ids = []; // ids of the forms as they are added
        this.fields = {}; // dictionary where forms will be added
        this.initial_name = name;
        this.new_field_idx = 0;
    }

    reset() {
        this.field_ids = [];
        this.fields = {};
        this.new_field_idx = 0;
        this.name = this.constructor.name == 'Schema' && this.status == 'draft'
            ? 'schema-editor'
            : this.parent ? this.parent.match(/(.+)-\d\.\d\.\d/)[1] : this.name;
    }

    fields_to_json() {
        this.properties = {};
        this.field_ids.forEach((field_id) => {
            this.properties[field_id] = this.fields[field_id].json;
        });
    }

    from_json(data) {
        this.name = data.schema_name || data.title;
        this.title = data.title;
        this.field_ids = Object.keys(data.properties);
        this.status = data.status;
        this.data_status = this.set_data_status();
        if (this.field_ids.length > 0) {
            for (let entry of Object.entries(data.properties)) {
                let new_field = InputField.choose_class(this.initial_name, this.data_status, entry);
                new_field.create_form();
                new_field.create_modal(this);

                this.fields[entry[0]] = new_field;
            }
        }
    }

    set_data_status() {
        if (this.status == undefined || this.status.startsWith('object')) {
            return `object-${this.parent_status}`;
        } else if (this.status == 'published') {
            return 'new';
        } else if (this.origin == undefined) {
            return 'draft';
        } else {
            return 'copy';
        }
    }

    display_options() {
        this.data_status = this.set_data_status(); // to make sure
        let formTemp = Field.quick("div", "formContainer");
        formTemp.id = this.data_status + '-templates';
        let modal_id = `${this.choice_id}-${this.data_status}`;
        let form_choice_modal = new Modal(modal_id, "What form element would you like to add?", "choiceTitle");
        form_choice_modal.create_modal([formTemp], 'lg');
        let this_modal = document.getElementById(modal_id);
        console.log(modal_id)
        this_modal.addEventListener('show.bs.modal', () => {
            let formTemp = this_modal.querySelector('div.formContainer');
            if (formTemp.childNodes.length == 0) {
                Object.values(this.initials).forEach((initial) => {
                    initial.schema_status = this.data_status;
                    formTemp.appendChild(initial.render(this));
                });
            }
        });
    }

    get form_div() {
        const form = this.data_status.startsWith('object')
            ? document.querySelector(`.modal#${this.card_id} form`)
            : document.querySelector(`form#form-${this.card_id}-${this.data_status}`);
        return form;
    }

    view_field(form_object) {
        let form = this.form_div;
        let clicked_button = form.querySelectorAll('.adder')[this.new_field_idx];
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

    toggle_saving() {
        let form = this.form_div;
        const has_duplicates = Object.values(this.fields).some((field) => field.is_duplicate);

        const buttons = this.constructor.name == 'Schema'
            ? ['publish', 'draft'].map((btn) => form.querySelector('button#' + btn))
            : [form.querySelector('button#add')];
        if (has_duplicates) {
            buttons.forEach((btn) => btn.setAttribute('disabled', ''));
        } else {
            buttons.forEach((btn) => btn.removeAttribute('disabled'));
        }
    }

    add_field(form_object) {
        // Register a created form field, add it to the fields dictionary and view it
        this.field_ids.splice(this.new_field_idx, 0, form_object.id);
        this.fields[form_object.id] = form_object;
        this.toggle_saving();

        this.view_field(form_object);
    }

    update_field(form_object) {
        // TODO have checks so we don't just replace everything
        this.fields[form_object.id] = form_object;
        let form = this.form_div;
        let viewer = form.querySelector('#' + form_object.id);
        viewer.querySelector('h5').innerHTML = form_object.required ? form_object.title + '*' : form_object.title;
        let rep_icon = Field.quick('i', 'bi bi-front px-2');
        if (form_object.repeatable) {
            viewer.querySelector('h5').appendChild(rep_icon);
        } else if (viewer.querySelector('h5 .bi-front') != null) {
            viewer.querySelector('h5').removeChild(rep_icon);
        }
        let form_field = viewer.querySelector('.card-body');
        let new_input = form_object.viewer_input();
        form_field.replaceChild(new_input, form_field.firstChild);
    }

    replace_field(old_id, form_object) {
        let form = this.form_div;
        const old_adder = form.querySelectorAll('.adder')[this.field_ids.indexOf(old_id)];
        old_adder.nextSibling.remove();
        old_adder.remove();
        delete this.fields[old_id];
        this.new_field_idx = this.field_ids.indexOf(old_id);
        this.field_ids.splice(this.new_field_idx, 1);
        this.add_field(form_object);
    }

    create_button() {
        // Create a button to create more form elements
        let div = Field.quick('div', 'd-grid gap-2 adder mt-2');
        let modal_id = `${this.choice_id}-${this.data_status}`
        let button = Field.quick("button", "btn btn-primary btn-sm", "Add element");
        button.type = "button";
        button.setAttribute("data-bs-toggle", "modal");
        button.setAttribute("data-bs-target", `#${modal_id}`);

        button.addEventListener('click', () => {
            this.new_field_idx = div.previousSibling.classList.contains('viewer') ?
                this.field_ids.indexOf(div.previousSibling.id) + 1 :
                0;
        });
        div.appendChild(button);
        return div;
    }

    static create_viewer(schema, active = false) {
        let div = schema.constructor.name == 'SchemaForm' ?
            Field.quick('form', 'mt-3 needs-validation') :
            Field.quick('div', 'input-view');
        schema.field_ids.forEach((field_id) => {
            let subfield = schema.fields[field_id];
            let small_div = Field.quick('div', 'mini-viewer');
            small_div.name = `viewer-${field_id}`;
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
                let icon = Field.quick('i', 'bi bi-front px-2');
                if (active) {
                    let button = Field.quick('button', 'btn btn-outline-dark p-0 mx-2');
                    button.type = 'button';
                    button.addEventListener('click', () => {
                        let clone = small_div.cloneNode(true);
                        let clone_button = clone.querySelector('button i');
                        clone_button.classList.remove('bi-front');
                        clone_button.classList.add('bi-trash');
                        clone_button.parentElement.addEventListener('click', () => clone.remove());

                        if (small_div.nextSibling == undefined) {
                            small_div.parentElement.appendChild(clone);
                        } else {
                            small_div.parentElement.insertBefore(clone, small_div.nextSibling);
                        }
                    })
                    button.appendChild(icon);
                    label.appendChild(button);
                } else {
                    label.appendChild(icon);
                }
            }
            let input = subfield.viewer_input(active = active);
            small_div.appendChild(label);
            small_div.appendChild(input);
            div.appendChild(small_div);
        });
        return div;
    }

}

class DummyObject extends ComplexField {
    constructor() {
        super('example', 'example', 'example');
        delete this.initials;
        this.field_ids = ['text', 'date', 'hair'];

        let name = new TypedInput('example');
        name.id = 'text';
        name.title = "Full name";
        name.value = "Jane Doe";
        this.fields.text = name;


        let bday = new TypedInput('example');
        bday.type = 'date';
        bday.title = "Birth date";
        bday.value = "1970-05-03";
        this.fields.date = bday;

        let hair = new SelectInput('example');
        hair.name = 'hair'
        hair.values.values = ['brown', 'red', 'blond', 'dark', 'pink'];
        hair.value = 'red';
        hair.title = "Hair color";
        this.fields.hair = hair;
    }
}

class ObjectEditor extends ComplexField {
    constructor(parent) {
        super('choice', parent.id, `object-${parent.schema_status}`);
        this.parent_status = parent.schema_status;
        if (parent.form_field) this.form_id = parent.form_field.form.id;
        this.id_field = `${parent.id}-id`;
    }

    get button() {
        return this.create_button();
    }

    clone(new_parent) {
        let clone = new ObjectEditor(new_parent);
        clone.field_ids = [...this.field_ids];
        clone.fields = { ...this.fields };
        return clone;
    }

}

class Schema extends ComplexField {
    constructor(card_id, container_id, urls, version = "1.0.0", data_status = 'draft') {
        super('choice', card_id, data_status);
        this.card_id = card_id;
        this.name = card_id.match(/^(.*)-\d\d\d$/)[1];
        this.version = version;
        this.container = container_id;
        this.urls = urls;
    }

    get accordion_item() {
        return this.card.div;
    }

    from_json(data) {
        super.from_json(data);
        this.name = data.schema_name;
        this.version = data.version;
        this.parent = data.parent;
    }

    create_creator() {
        this.status = 'draft';
        this.display_options(this.status);
        let form = this.create_editor();
        this.card = new AccordionItem(this.card_id, 'New schema', this.container, true);
        document.getElementById(this.container).appendChild(this.accordion_item);
        this.card.append(form.form);
    }

    create_editor() {
        let form = new BasicForm(`${this.card_id}-${this.data_status}`);
        let is_new = this.data_status == 'copy' || this.card_id.startsWith('schema-editor');
        form.add_input("Schema ID", this.card_id + '-name', {
            placeholder: "schema-name", validation_message: "This field is compulsory, please only use lower case letters, '_' and '-'.",
            pattern: "[a-z0-9-_]+", description: is_new ? "This cannot be changed after the draft is saved." : false
        });

        form.add_input("Schema label", this.card_id + '-label', {
            placeholder: "Some informative label",
            validation_message: "This field is compulsory.",
            description: is_new ? "This cannot be changed once a version has been published." : false
        });

        let button = this.create_button();
        form.form.insertBefore(button, form.divider);
        form.add_action_button("Save draft", 'draft');
        form.add_submit_action('draft', (e) => {
            e.preventDefault();
            if (!form.form.checkValidity()) {
                e.stopPropagation();
                form.form.classList.add('was-validated');
            } else {
                // save form!
                this.save_draft(form, 'save');
                form.form.classList.remove('was-validated');
            }
        });
        form.add_action_button("Publish", 'publish', 'warning');

        let name_input = form.form.querySelector(`#${this.card_id}-name`);

        if (!is_new) {
            name_input.setAttribute('readonly', '');
        } else if (!this.field_ids.length > 0) {
            form.form.querySelector('button#publish').setAttribute('disabled', '');
        }

        if (this.card_id.startsWith('schema-editor') || schemas[this.name].published.length + schemas[this.name].archived.length > 0) {
            form.form.querySelector(`#${this.card_id}-label`).setAttribute('readonly', '');
        }

        if (this.field_ids.length == 0) {
            form.form.querySelector('button#publish').setAttribute('disabled', '');
        }

        form.add_submit_action('publish', (e) => {
            e.preventDefault();
            if (!form.form.checkValidity()) {
                e.stopPropagation();
                form.form.classList.add('was-validated');
            } else {
                console.log('Ready to publish');

                let second_sentence = schemas[this.name] && schemas[this.name].published.length > 0 ?
                    ` Version ${schemas[this.name].published[0].version} will be archived.` :
                    ''
                const toast = new Toast(this.card_id + '-pub',
                    "Published schemas cannot be edited." + second_sentence);
                toast.show(() => {
                    // save form!
                    this.save_draft(form, 'publish');
                    form.form.classList.remove('was-validated');
                });
            }
        })
        return form;
    }

    from_parent(parent) {
        this.field_ids = [...parent.field_ids];
        this.parent = `${parent.name}-${parent.version}`;
        this.initial_name = `${parent.name}-new`;
        this.status = 'draft';
        this.origin = { ids: [...parent.field_ids], json: { ...parent.properties } };
        if (this.field_ids.length > 0) {
            for (let entry of Object.entries(parent.properties)) {
                let new_field = InputField.choose_class(this.initial_name, 'child', entry);
                new_field.create_form();
                new_field.create_modal(this);
                this.fields[entry[0]] = new_field;
            }
        }
    }

    setup_copy() {
        this.fields_to_json()
        this.child = new Schema(this.card_id, this.container, this.urls,
            "1.0.0", "copy");
        this.child.from_parent(this);
    }

    create_navbar() {
        // design navbar
        this.nav_bar = new NavBar(this.card_id, ['justify-content-end', 'nav-pills']);
        this.nav_bar.add_item('view', 'View', true);

        let viewer = ComplexField.create_viewer(this);
        this.nav_bar.add_tab_content('view', viewer);

        if (this.status == 'draft') {
            this.nav_bar.add_item('edit', 'Edit');

            this.display_options(this.status);
            let form = this.create_editor(this.status);
            let inputs = form.form.querySelectorAll('input.form-control');
            inputs[0].value = this.name; // id
            inputs[1].value = this.title; // label
            this.nav_bar.add_tab_content('edit', form.form);

            this.nav_bar.add_action_button('Discard', 'danger', () => {
                const toast = new Toast(this.card_id + '-discard',
                    "A deleted draft cannot be recovered.");
                toast.show(() => {
                    schemas[this.name].draft = [];
                    this.delete();
                    let published_version = schemas[this.name].published[0];
                    if (published_version != undefined) {
                        published_version.draft_from_publish();
                        published_version.field_ids.forEach((field_id, idx) => {
                            published_version.new_field_idx = idx;
                            published_version.view_field(published_version.fields[field_id]);
                        });
                    }
                    if (schemas[this.name].published.length + schemas[this.name].archived.length == 0) {
                        // if there are no published or archived versions, delete the accordion item
                        document.querySelector(`.accordion-collapse#${this.name}-schemas`)
                            .parentElement
                            .remove();
                    } else {
                        // just delete the draft tab
                        new NavBar(this.name)
                            .remove_item(`v${this.version.replaceAll('.', '')}`);
                        let trigger = document.querySelector(`#nav-tab-${this.name} button`);
                        bootstrap.Tab.getOrCreateInstance(trigger).show();
                    }
                });
            });
        } else if (this.status == 'published') {
            this.draft_from_publish();
            this.setup_copy();
            this.child.display_options();
            this.nav_bar.add_item('child', 'Copy to new schema');
            let child_form = this.child.create_editor();
            this.nav_bar.add_tab_content('child', child_form.form);

            this.nav_bar.add_action_button('Archive', 'danger', () => {
                const toast = new Toast(this.card_id + '-discard',
                    "Archived schemas cannot be implemented.");
                toast.show(() => {
                    // schemas[this.name].archived.push = schemas[this.name].published[0];
                    schemas[this.name].published = [];
                    this.delete();
                    if (schemas[this.name].draft.length + schemas[this.name].archived.length == 0) {
                        // if there are no published or archived versions, delete the accordion item
                        document.querySelector(`.accordion-collapse#${this.name}-schemas`)
                            .parentElement
                            .remove();
                    } else {
                        // just delete the draft tab
                        new NavBar(this.name)
                            .remove_item(`v${this.version.replaceAll('.', '')}`);
                        let trigger = document.querySelector(`#nav-tab-${this.name} button`);
                        bootstrap.Tab.getOrCreateInstance(trigger).show();
                    }
                });
            });
        }
    }

    draft_from_publish() {
        if (schemas[this.name].draft.length == 0) {
            this.display_options();
            this.nav_bar.add_item('new', 'New (draft) version', false, 1);
            let new_form = this.create_editor();
            let inputs = new_form.form.querySelectorAll('input.form-control');
            inputs[0].value = this.name; // id
            inputs[1].value = this.title; // label

            this.nav_bar.add_tab_content('new', new_form.form);
        }
    }

    view() {
        this.create_navbar();
        this.card = document.createElement('div')
        this.card.id = this.card_id;
        this.card.appendChild(this.nav_bar.nav_bar);
        this.card.appendChild(this.nav_bar.tab_content);
        document.getElementById(this.container).appendChild(this.card);
        if (this.field_ids.length == 0) {
            let msg = Field.quick('div', 'viewer',
                'This schema does not have any fields yet. Go to "edit" mode to add one.');
            this.nav_bar.tab_content.querySelector('.input-view').appendChild(msg);
        }

        this.field_ids.forEach((field_id, idx) => {
            this.new_field_idx = idx;
            this.view_field(this.fields[field_id]);
            if (this.status == 'published') {
                this.child.new_field_idx = idx;
                this.child.view_field(this.child.fields[field_id]);
            }
        });
    }

    save_draft(form, action) {
        // action indicates whether it's saved or published
        let is_new = this.card_id.startsWith('schema-editor');
        let is_copy = this.data_status == 'copy';
        let status = action == 'publish' ? 'published' : 'draft'
        if (is_new | is_copy) {
            // create a child/copy from a published version
            let name = form.form.querySelector(`#${this.card_id}-name`).value;
            let label = form.form.querySelector(`#${this.card_id}-label`).value;
            this.fields_to_json();
            let json_contents = {
                schema_name: name,
                title: label,
                version: '1.0.0',
                status: status,
                properties: this.properties
            };
            if (is_copy) {
                json_contents.parent = this.parent;
            }

            // container_id is the GLOBAL variable
            new SchemaGroup(name, label,
                [{ name: name, version: '1.0.0', status: status, json: json_contents }],
                container_id, this.urls);
            form.reset();
            form.form.querySelectorAll('.viewer').forEach((viewer) => {
                viewer.nextSibling.remove();
                viewer.remove();
            });
            this.reset();
            if (is_new) {
                this.card.toggle();
            } else {
                this.field_ids = [...this.origin.ids];
                if (this.field_ids.length > 0) {
                    this.field_ids.forEach((field_id, idx) => {
                        let new_field = InputField.choose_class(this.initial_name, 'draft', [field_id, this.origin.json[field_id]]);
                        this.fields[field_id] = new_field;
                        new_field.create_form();
                        new_field.create_modal(this);
                        this.new_field_idx = idx;
                        this.view_field(new_field);
                    });
                }
            }

        } else if (this.data_status == 'draft') {
            // this schema was modified
            this.name = form.form.querySelector(`#${this.card_id}-name`).value;
            this.title = form.form.querySelector(`#${this.card_id}-label`).value;
            this.status = status;

            // update accordion title
            if (schemas[this.name].published.length + schemas[this.name].archived.length == 0) {
                document.getElementById(`${this.name}-schemas-header`)
                    .querySelector(`button.h4`)
                    .innerHTML = this.title;
            }

            // update badge
            let status_badge = document
                .querySelectorAll(`#v${this.version.replaceAll('.', '')}-tab-${this.name} img`)[1];
            status_badge.setAttribute('alt', 'status published');
            status_badge.setAttribute('name', 'published');
            status_badge.setAttribute('src', `${SchemaGroup.badge_url}-${status}-${SchemaGroup.status_colors[status]}`);


            // update internal tabs
            if (action == 'publish') {
                if (schemas[this.name].published.length > 0) {
                    let published_version = schemas[this.name].published[0].version;
                    schemas[this.name].archived.push(schemas[this.name].published[0]);
                    let nav_bar = new NavBar(this.name);
                    nav_bar.remove_item(`v${published_version.replaceAll('.', '')}`);
                    // actually archive it
                }
                schemas[this.name].published = [this];
                schemas[this.name].draft = [];
                document.getElementById(this.card_id).remove();
                this.field_ids.forEach((field_id) => {
                    this.fields[field_id].create_modal(this);
                });
                this.view();
            } else {
                let old_input_view = document
                    .querySelector(`#view-pane-${this.card_id}`)
                    .querySelector('.input-view');
                let new_input_view = ComplexField.create_viewer(this);
                old_input_view.parentElement.replaceChild(new_input_view, old_input_view);
            }


            this.post();
            let trigger = document.querySelector(`#nav-tab-${this.card_id} button`);
            bootstrap.Tab.getOrCreateInstance(trigger).show();

        } else if (this.data_status == 'new') {
            // create the new version
            let incremented_major = parseInt(this.version.split('.')[0]) + 1;
            let new_version = `${incremented_major}.0.0`;
            let no_dots = new_version.replaceAll('.', '');

            let badges = SchemaGroup.add_version(new_version, status);
            let nav_bar = new NavBar(this.name);
            nav_bar.add_item('v' + no_dots, badges);

            let new_schema = new Schema(`${this.name}-${no_dots}`,
                'v' + incremented_major + this.container.slice(2), // adapt to other increments
                this.urls, new_version);
            if (action == 'published') {
                schemas[this.name].archived.push(schemas[this.name].published[0]);
                schemas[this.name].published = [new_schema];
                new NavBar(this.name).remove_item(`v${published_version.replaceAll('.', '')}`);
                let trigger = document.querySelector(`#nav-tab-${this.name} button`);
                bootstrap.Tab.getOrCreateInstance(trigger).show();
            } else {
                schemas[this.name].draft = [new_schema];
                new NavBar(this.card_id).remove_item('new');
                let trigger = document.querySelector(`#nav-tab-${this.card_id} button`);
                bootstrap.Tab.getOrCreateInstance(trigger).show();
            }
            this.fields_to_json();
            let json_contents = {
                schema_name: this.name,
                title: this.title,
                version: new_version,
                status: status,
                properties: this.properties
            }
            new_schema.from_json(json_contents);
            new_schema.view();
            new_schema.post();

        }
    }

    delete() {
        const to_post = new FormData();
        to_post.append('realm', realm);
        to_post.append('schema_name', this.name);
        to_post.append('with_status', this.status);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.status == 'draft' ? this.urls.delete : this.urls.archive, true);
        xhr.send(to_post);
        console.log(`${this.name} version ${this.version} (${this.status}) ${this.status == 'draft' ? 'deleted' : 'archived'}.`);
    }

    post() {
        const to_post = new FormData();
        this.fields_to_json();
        to_post.append('realm', realm);
        to_post.append('schema_name', this.name);
        to_post.append('current_version', this.version);
        to_post.append('raw_schema', JSON.stringify(this.properties));
        to_post.append('with_status', this.status);
        to_post.append('title', this.title);
        if (this.parent) {
            to_post.append('parent', this.parent);
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.urls.new, true);
        xhr.send(to_post);
        console.log(`${this.name} version ${this.version} (${this.status}) posted.`);
    }
}

class SchemaGroup {
    static badge_url = 'https://img.shields.io/badge/';
    static status_colors = {
        'published': 'success',
        'draft': 'orange',
        'archived': 'inactive'
    }

    constructor(name, title, versions, container_id, urls) {
        this.name = name;
        this.title = title;
        this.versions = versions;
        // obtain versions from published_ and draft_name with regex
        let nav_bar = new NavBar(this.name, ['nav-tabs']);
        this.statuses = this.versions.map((v) => v.status);
        this.urls = urls;
        this.summary = {};
        Object.keys(SchemaGroup.status_colors).forEach((st) => {
            this.summary[st] = this.versions
                .filter((v) => v.status == st)
                .map((v) => v.version);
        });
        schemas[name] = this.summary;

        let acc_item = new AccordionItem(this.name + '-schemas', this.title, container_id);
        acc_item.append(nav_bar.nav_bar);

        acc_item.append(nav_bar.tab_content);
        document.getElementById(container_id).appendChild(acc_item.div);
        this.load_versions(nav_bar);

    }

    load_versions(nav_bar) {
        for (let version of this.versions) {
            let badges = SchemaGroup.add_version(version.version, version.status);
            let active = this.statuses.indexOf('published') > -1 ? version.status == 'published' : version.status == 'draft';
            // this does not account for a case with only archived versions and a draft
            let version_number = version.version.replaceAll('\.', '');
            nav_bar.add_item(`v${version_number}`, badges, active);
            let tab_id = `v${version_number}-pane-${this.name}`;
            let this_version = schemas[this.name][version.status].indexOf(version.version)
            let schema = new Schema(
                `${version.name}-${version_number}`, tab_id,
                this.urls, version.version);
            schemas[this.name][version.status][this_version] = schema;
            schema.loaded = false;
            if (version.json != undefined) {
                schema.loaded = true;
                schema.from_json(version.json);
                schema.view();
                schema.post();
            } else {
                let reader = new TemplateReader(this.urls.get.replace('status', version.status), schema); // url to get this template

                const accordion = nav_bar.tab_content.parentElement.parentElement;
                accordion.addEventListener('show.bs.collapse', () => {
                    const tab = accordion.querySelector('#' + tab_id);
                    if (tab.classList.contains('show')) {
                        if (!schema.loaded) {
                            reader.retrieve();
                            schema.loaded = true;
                        }
                    } else {
                        nav_bar.nav_bar.querySelector(`button#v${version_number}-tab-${this.name}`)
                            .addEventListener('show.bs.tab', () => {
                                if (!schema.loaded) {
                                    reader.retrieve();
                                    schema.loaded = true;
                                }
                            });
                    }
                });
            }
        };
    }

    static add_version(version, status) {
        let version_badge = document.createElement('img');
        version_badge.setAttribute('alt', 'version ' + version);
        version_badge.setAttribute('name', version);
        version_badge.setAttribute('src', `${SchemaGroup.badge_url}version-${version}-blue`);

        let status_badge = Field.quick('img', 'mx-2');
        status_badge.setAttribute('alt', 'status ' + status);
        status_badge.setAttribute('name', status);
        status_badge.setAttribute('src', `${SchemaGroup.badge_url}-${status}-${SchemaGroup.status_colors[status]}`);
        return [version_badge, status_badge]
    }
}

class SchemaForm {
    constructor(json, container_id, prefix) {
        this.name = json.schema_name;
        this.title = json.title;

        this.container = container_id; // div in which to render
        this.prefix = prefix; // for flattening

        this.realm = json.realm;
        this.version = json.version;
        this.parent = json.parent;

        this.fields = {};
        this.field_ids = Object.keys(json.properties);
        this.from_json(json.properties);
    }

    from_json(schema_json) {
        for (let entry of Object.entries(schema_json)) {
            let new_field = InputField.choose_class(this.name, '', entry);
            if (new_field.constructor.name == 'ObjectInput') {
                new_field.editor = new ObjectEditor(new_field);
                new_field.editor.from_json(new_field.json_source);
            }
            this.fields[entry[0]] = new_field;
        }
        SchemaForm.flatten_object(this, this.prefix);
        let form_div = ComplexField.create_viewer(this, true);

        let title = document.createElement('h3');
        title.innerHTML = `<small class="text-muted">Metadata schema:</small> ${this.title} ${this.version}`;
        document.getElementById(this.container).appendChild(title);

        let submitting_row = Field.quick('div', 'row border-top pt-2')

        let submitter = Field.quick('button', 'btn btn-primary', 'Save metadata');
        submitter.type = 'submit';
        submitter.addEventListener('click', (e) => {
            e.preventDefault();
            if (!form_div.checkValidity()) {
                e.stopPropagation();
                form_div.classList.add('was-validated');
            } else {
                // save form!
                console.log('submitting');
                this.post();
            }
        });
        submitting_row.appendChild(submitter);
        form_div.appendChild(submitting_row);

        document.getElementById(this.container).appendChild(form_div);
        this.form = form_div;
        this.names = [...this.form.querySelectorAll('input, select')].map((x) => x.name);
        
    }

    post() {
        const data = new FormData(this.form);
        for (const pair of data.entries()) {
            if (pair[1].length > 0) {
                console.log(`${pair[0]}, ${pair[1]}`);
            }
        }
        const url = new URL(window.location.href)
        const url_params = url.searchParams;
        for (let item of ['item_type', 'object_path', 'schema', 'realm']) {
            data.append(item, url_params.get(item));
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', post_url, true);
        xhr.send(data);
        const path_url = `${url.origin}/${url_params.get('item_type')}/browse/${url_params.get('object_path')}`
        window.open(path_url, '_self');
    }

    add_annotation(annotated_data) {
        // this still needs to be tested
        // as list of key-value pairs?
        let keys = Object.keys(annotated_data).filter((x) => x.startsWith(this.prefix));
        let non_objects = [...new Set(keys)].filter((fid) => fid.split('.').length == 3);
        non_objects.forEach((fid) => this.register_non_object(fid, annotated_data));
        let in_objects = keys.filter((fid) => fid.split('.').length > 3);
        let objs = [...new Set(in_objects.map((x) => x.match(`${this.prefix}.(?<field>[^\.]+).*`).groups.field))];
        objs.forEach((fid) => this.register_object(fid, annotated_data, in_objects));
        return;
    }

    register_object(obj, annotated_data, object_fields, prefix = null) {
        prefix = prefix || this.prefix;
        console.log(obj);
        let fields = object_fields.filter((fid) => fid.startsWith(`${prefix}.${obj}.`));
        console.log(fields);
        // THIS CODE DOES NOT DEAL WITH DUPLICATED OBJECTS (TEMPORARILY DISABLED)
        let viewer = this.form.querySelector(`h5#viewer-${obj}`).parentElement;
        
        let not_nested = fields.filter((fid) => fid.split('.').length == (prefix.split('.').length + 2));
        not_nested.forEach((fid) => this.register_non_object(fid, annotated_data, viewer));

        let nested = fields.filter((fid) => fid.split('.').length > (prefix.split('.').length + 2));
        let sub_objs = [...new Set(nested.map((x) => x.match(`${prefix}.${obj}.(?<field>[^\.]+).*`).groups.field))];      
        sub_objs.forEach((fid) => this.register_object(fid, annotated_data, nested, `${prefix}.${obj}`));
    }

    register_non_object(fid, annotated_data, form = null) {
        form = form || this.form;
        let existing_values = annotated_data[fid];
        let is_checkbox = this.names.filter((x) => x == fid).length > 1;
        
        if (is_checkbox) {
            form.querySelectorAll(`[name="${fid}"]`)
                .forEach((chk) => {
                    if (existing_values.indexOf(chk.value) > -1) chk.setAttribute('checked', '');
                });
        } else if (existing_values.length == 1) {
            form.querySelector(`[name="${fid}"]`).value = existing_values[0];
        } else {
            // if the field has been duplicated
            let field_id = fid.match(`${this.prefix}.(?<field>.+)`).groups.field;
            for (let i = 0; i < existing_values.length; i++) {
                let viewer = form.querySelectorAll(`div.mini-viewer[name="${field_id}"]`)[i];
                let sibling = viewer.nextSibling;
                let value = existing_values[i];
                if (i == 0) {
                    viewer.querySelector('input').value = value;
                } else {
                    let new_viewer = viewer.cloneNode(true);
                    new_viewer.querySelector('input').value = value;
                    sibling == undefined ? form.appendChild(new_viewer) : form.insertBefore(new_viewer, sibling);
                }
            }
        }
    }

    static flatten_object(object_editor, flattened_id) {
        object_editor.field_ids.forEach((field_id) => {
            let subfield_flattened = `${flattened_id}.${field_id}`;
            if (object_editor.fields[field_id].constructor.name == 'ObjectInput') {
                SchemaForm.flatten_object(object_editor.fields[field_id].editor, subfield_flattened);
            } else {
                object_editor.fields[field_id].name = subfield_flattened;
            }
        });
    }
}
