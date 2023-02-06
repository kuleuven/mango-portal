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

    reset() {
        this.field_ids = [];
        this.fields = {};
        this.new_field_idx = 0;
        this.name = this.constructor.name == 'Schema' && this.status == 'draft' ? 'schema-editor-schema' : this.name;
    }


    to_json() {
        let base_data = {
            title: this.name,
            properties: {}
        }
        if (this.constructor.name == 'Schema') {
            base_data.version = this.version;
            base_data.status = this.status;
            if (this.parent != undefined) {
                data.parent = this.parent;
            }
        } else {
            base_data.type = "object";
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
            let new_field = InputField.choose_class(data.title, entry);
            new_field.create_modal(this);
            this.fields[entry[0]] = new_field;
        }
    }

    display_options(id) {
        let formTemp = Field.quick("div", "formContainer");
        formTemp.id = id + '-templates';

        let form_choice_modal = new Modal(this.choice_id, "What form element would you like to add?", "choiceTitle");
        form_choice_modal.create_modal([formTemp], 'lg');
        let this_modal = document.getElementById(this.choice_id);
        this_modal.addEventListener('show.bs.modal', () => {
            let formTemp = this_modal.querySelector('div.formContainer');
            if (formTemp.childNodes.length == 0) {
                Object.values(this.initials).forEach((initial) => {
                    formTemp.appendChild(initial.render(this, id));
                });
            }
        });
    }

    view_field(form_object, form_id) {
        let clicked_button = document.getElementById(`form-${this.card_id}-${form_id}`).querySelectorAll('.adder')[this.new_field_idx];
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

    add_field(form_object, id) {
        // Register a created form field, add it to the fields dictionary and view it
        this.field_ids.splice(this.new_field_idx, 0, form_object.id);
        this.fields[form_object.id] = form_object;
        this.view_field(form_object, id);
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

    replace_field(old_id, form_object, id) {
        delete this.fields[old_id];
        this.new_field_idx = this.field_ids.indexOf(old_id);
        this.field_ids.splice(this.new_field_idx, 1);
        this.add_field(form_object, id);
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

}

class Schema extends ComplexField {
    constructor(card_id, container_id, url, version = "1.0.0",
        statuses = { 'draft': ['1.0.0'], 'published': [], 'archived': [] }) {
        super('formChoice', card_id);
        this.card_id = card_id + '-schema';
        this.name = card_id.replace(`-${version}`, '');
        this.full_name = card_id;
        this.version = version;
        this.container = container_id;
        this.url = url;
        this.statuses = statuses;
    }

    get accordion_item() {
        return this.card.div;
    }

    save_draft(form, id, action) {
        // action indicates whether it's saved or published
        let is_new = this.card_id.startsWith('schema-editor');
        let is_copy = id == 'copy';
        let status = action == 'publish' ? 'published' : 'draft'
        if (is_new | is_copy) {
            // create a child/copy from a published version
            let name = form.form.querySelector(`#${this.card_id}-name`).value;
            let json_contents = Object.values(this.to_json())[0];
            json_contents.title = name;
            json_contents.version = '1.0.0';
            json_contents.status = status;
            if (is_copy) {
                json_contents.parent = this.full_name;
            }

            let template = {
                schema_name: name,
                template_list: [{
                    name: `${name}-v1.0.0-${status}`
                }]
            };
            // container_id is the GLOBAL variable
            new SchemaGroup(template, container_id);
            let new_schema = new Schema(`${name}-100`,
                `v100-pane-${name}`, this.url,
                "1.0.0");
            new_schema.from_json(json_contents);
            new_schema.view();
            // new_schema.post();

            if (is_new) {
                form.reset();
                form.form.querySelectorAll('.viewer').forEach((viewer) => {
                    viewer.nextSibling.remove();
                    viewer.remove();
                });
                this.reset();
                this.card.toggle();
            }
        } else if (id == 'draft') {
            // this schema was modified
            this.name = form.form.querySelector(`#${this.card_id}-name`).value;
            this.status = status;

            // update badge
            let status_badge = document
                .querySelectorAll(`#v${this.version.replaceAll('.', '')}-tab-${this.name} img`)[1];
            status_badge.setAttribute('alt', 'status published');
            status_badge.setAttribute('name', 'published');
            status_badge.setAttribute('src', `${SchemaGroup.badge_url}-${status}-${SchemaGroup.status_colors[status]}`)

            // update internal tabs
            if (action == 'publish') {
                if (this.statuses.published.length > 0) {
                    let published_version = this.statuses.published[0];
                    this.statuses.archived.push(published_version);
                    let nav_bar = new NavBar(this.name);
                    nav_bar.remove_item(`v${published_version.replaceAll('.', '')}`);
                    // actually archive it
                }
                this.statuses.published = [this.version];
                this.statuses.draft = [];
                document.getElementById(this.card_id).remove();
                this.view();
            } else {
                let old_input_view = document
                    .querySelector(`#view-pane-${this.full_name}`)
                    .querySelector('.input-view');
                let new_input_view = ComplexField.create_viewer(this);
                old_input_view.parentElement.replaceChild(new_input_view, old_input_view);
            }


            // this.post();
            let trigger = document.querySelector(`#nav-tab-${this.full_name} button`);
            bootstrap.Tab.getOrCreateInstance(trigger).show();

        } else if (id == 'new') {
            // create the new version
            let incremented_major = parseInt(this.version.split('.')[0]) + 1;
            let new_version = `${incremented_major}.0.0`;
            let no_dots = new_version.replaceAll('.', '');

            let badges = SchemaGroup.add_version(new_version, status);
            let nav_bar = new NavBar(this.name);
            nav_bar.add_item('v' + no_dots, badges);

            if (action == 'published') {
                this.statuses.archived.push(this.version);
                this.statuses.draft = [new_version];
                new NavBar(this.name).remove_item(`v${published_version.replaceAll('.', '')}`);
                let trigger = document.querySelector(`#nav-tab-${this.name} button`);
                bootstrap.Tab.getOrCreateInstance(trigger).show();
            } else {
                this.statuses.draft = [new_version];
                new NavBar(this.full_name).remove_item('new');
                let trigger = document.querySelector(`#nav-tab-${this.full_name} button`);
                bootstrap.Tab.getOrCreateInstance(trigger).show();
            }
            let new_schema = new Schema(`${this.name}-${no_dots}`,
                'v' + incremented_major + this.container.slice(2), // adapt to other increments
                this.url, new_version, this.statuses);
            let json_contents = Object.values(this.to_json())[0];
            json_contents.version = new_version;
            json_contents.status = status;
            new_schema.from_json(json_contents);
            new_schema.view();
            // new_schema.post();
            
        }
    }

    create_editor(id) {
        let form = new BasicForm(`${this.card_id}-${id}`);
        form.add_input("Metadata template name", this.card_id + '-name', {
            placeholder: "schema-name", validation_message: "This field is compulsory, please only use lower case letters and '-'.",
            pattern: "[a-z0-9-]+"
        });
        console.log(this.statuses)

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
                this.save_draft(form, id, 'save');
                form.form.classList.remove('was-validated');
            }
        });
        form.add_action_button("Publish", 'publish', 'warning');
        form.add_submit_action('publish', (e) => {
            e.preventDefault();
            if (!form.form.checkValidity()) {
                e.stopPropagation();
                form.form.classList.add('was-validated');
            } else {
                console.log('Ready to publish');
                console.log(this.statuses)

                let second_sentence = this.statuses.published.length > 0 ?
                    ` Version ${this.statuses.published[0]} will be archived.` :
                    ''
                const toast = new Toast(this.full_name + '-pub',
                    "Published schemas cannot be edited." + second_sentence);
                toast.show(() => {
                    // save form!
                    this.save_draft(form, id, 'publish');
                    form.form.classList.remove('was-validated');
                });
            }
        })
        return form;
    }

    create_creator() {
        this.status = 'draft';
        this.display_options(this.status);
        let form = this.create_editor(this.status);
        this.card = new AccordionItem(this.full_name + '-schema', 'New schema', this.container, true);
        document.getElementById(this.container).appendChild(this.accordion_item);
        this.card.append(form.form);
    }

    create_navbar() {
        // design navbar
        let nav_bar = new NavBar(this.full_name, ['justify-content-end', 'nav-pills']);
        nav_bar.add_item('view', 'View', true);

        let viewer = ComplexField.create_viewer(this);
        nav_bar.add_tab_content('view', viewer);

        if (this.status == 'draft') {
            nav_bar.add_item('edit', 'Edit');

            this.display_options(this.status);
            let form = this.create_editor(this.status);
            form.form.querySelector('input.form-control').value = this.name;
            nav_bar.add_tab_content('edit', form.form);

            nav_bar.add_action_button('Discard', 'danger', () => {
                const toast = new Toast(this.full_name + '-discard',
                    "A deleted draft cannot be recovered.");
                toast.show(() => {
                    if (this.statuses.published.length + this.statuses.archived.length == 0) {
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
            if (this.statuses.draft.length == 0) {
                this.display_options('new');
                nav_bar.add_item('new', 'New version');
                let new_form = this.create_editor('new');
                new_form.form.querySelector('input.form-control').value = this.name;
                new_form.form.querySelector('input.form-control').setAttribute('readonly', '');
                nav_bar.add_tab_content('new', new_form.form);
            }

            this.display_options('copy');
            nav_bar.add_item('child', 'New from copy');
            let child_form = this.create_editor('copy');
            nav_bar.add_tab_content('child', child_form.form);

            nav_bar.add_action_button('Archive', 'danger', () => {
                const toast = new Toast(this.full_name + '-discard',
                    "Archived schemas cannot be implemented.");
                toast.show(() => {
                    if (this.statuses.draft.length + this.statuses.archived.length == 0) {
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

        this.nav_bar = nav_bar.nav_bar;
        this.tab_content = nav_bar.tab_content;

    }

    view() {
        // console.log('This is version', this.version, 'of', this.name, 'which has status:', this.status);

        this.create_navbar();
        this.card = document.createElement('div')
        this.card.id = this.card_id;
        this.card.appendChild(this.nav_bar);
        this.card.appendChild(this.tab_content);
        // console.log(this.container)
        document.getElementById(this.container).appendChild(this.card);

        this.field_ids.forEach((field_id, idx) => {
            this.new_field_idx = idx;
            if (this.status == 'draft') {
                this.view_field(this.fields[field_id], 'draft');
            } else {
                if (this.statuses.draft.length == 0) {
                    this.view_field(this.fields[field_id], 'new');
                }
                this.view_field(this.fields[field_id], 'copy');
            }
        });
    }

    from_json(data) {
        super.from_json(data);
        this.status = data.status;
        this.version = data.version;
        this.parent = data.parent;

        if (this.status != 'draft') {
            this.fixed = Object.values(this.to_json())[0];
        }
    }

    post() {
        const to_post = new FormData();
        let fname = `${this.name}-v${this.version}`;
        to_post.append('template_name', this.status == archived ? fname : `${fname}-${this.status}`);
        to_post.append('template_json', JSON.stringify(this.to_json()));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.url, true);
        xhr.send(to_post);
        console.log(this.name, 'posted.');
    }
}

class SchemaGroup {
    static badge_url = 'https://img.shields.io/badge/';
    static status_colors = {
        'published': 'success',
        'draft': 'orange',
        'archived': 'inactive'
    }

    constructor(template, container_id) {
        this.name = template.schema_name;
        this.versions = template.template_list.map((temp) => {
            let temp_info = temp.name.split('-v')[1].split('-');
            let status = temp_info[1].startsWith('draft') ? 'draft' : temp_info[1].startsWith('published') ? 'published' : 'archived';
            let data = {
                version: temp_info[0],
                status: status
            }
            return (data);
        });

        let nav_bar = new NavBar(this.name, ['nav-tabs']);
        this.statuses = this.versions.map((v) => v.status);

        for (let version of this.versions) {
            let badges = SchemaGroup.add_version(version.version, version.status);
            let active = this.statuses.indexOf('published') > -1 ? version.status == 'published' : version.status == 'draft';
            // this does not account for a case with only archived versions and a draft
            nav_bar.add_item(`v${version.version.replaceAll('.', '')}`, badges, active);
        };

        let acc_item = new AccordionItem(this.name + '-schemas', this.name, container_id);
        acc_item.append(nav_bar.nav_bar);
        acc_item.append(nav_bar.tab_content);
        document.getElementById(container_id).appendChild(acc_item.div);
    }

    get summary() {
        let statuses = Object.keys(SchemaGroup.status_colors);
        let summary = {};
        statuses.forEach((st) => {
            summary[st] = this.versions
                .filter((v) => v.status == st)
                .map((v) => v.version);
        });
        return (summary);
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
