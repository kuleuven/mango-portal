const tbody = document.querySelector('#browseTable tbody');
const tbody_checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
const badge_counter = document.querySelector('#browseTable thead span.badge');
const go_button = document.querySelector('#collection-content button');
const select_all = document.querySelector('#browseTable input#select_all');
const urls = document.querySelector('bulk-links');
select_all.addEventListener('change', () => {
    if (select_all.checked) {
        tbody_checkboxes.forEach((el) => el.checked = true);
        go_button.removeAttribute('disabled');
        if (select_all.parentElement.querySelector('span.badge') == null) {
            select_all.parentElement.appendChild(badge_counter);
        }
        badge_counter.innerHTML = tbody_checkboxes.length;
    } else {
        tbody_checkboxes.forEach((el) => el.checked = false);
        go_button.setAttribute('disabled', '');
        select_all.parentElement.removeChild(badge_counter);
    }
});

tbody_checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        let are_checked = [...tbody_checkboxes].filter((c) => c.checked).length;
        badge_counter.innerHTML = are_checked;
        if (checkbox.checked) {
            go_button.removeAttribute('disabled');
            if (are_checked == 1) {
                select_all.parentElement.appendChild(badge_counter)
            }
            if (are_checked == tbody_checkboxes.length) {
                select_all.checked = true;
            }
        } else {
            select_all.checked = false;
            if (are_checked == 0) {
                go_button.setAttribute('disabled', '');
                select_all.parentElement.removeChild(badge_counter);
            }
        }
    })
});
function apply_bulk_operation() {
    const selected_option = document.querySelector('#collection-content select');
    const selected_items = [...tbody_checkboxes].filter((c) => c.checked).map((c) => c.value);
    const n_collections = selected_items.filter((c) => c.startsWith('col-')).length;
    const n_dobjects = selected_items.filter((c) => c.startsWith('dobj-')).length;
    const n_collections_printed = `${n_collections} collection${n_collections > 1 ? "s" : ""}`;
    const n_dobjects_printed = `${n_dobjects} data object${n_dobjects > 1 ? "s" : ""}`;
    const n_items = n_collections == 0 // if there are only objects
        ? n_dobjects_printed
        : n_dobjects == 0 // if there are only collections
            ? n_collections_printed
            : `${n_collections_printed} and ${n_dobjects_printed}`;

    const confirmation_modal = document.querySelector('div.modal#confirmation-dialog');
    const modal = bootstrap.Modal.getOrCreateInstance(confirmation_modal);
    const confirmation_form = confirmation_modal.querySelector('form#confirmation-form');
    confirmation_form.querySelector('input#action').value = selected_option.value;

    const items_to_send = selected_option.value == 'copy'
        ? selected_items.filter((c) => c.startsWith('dobj-'))
        : selected_items;
    const confirmation_text = confirmation_form.querySelector('p#confirmation-text')
    // clean previous items if existing
    const existing_items = confirmation_form.querySelectorAll('input[name="items"]');
    if (existing_items.length > 0) {
        existing_items.forEach((x) => x.remove());
    }
    items_to_send.forEach((item) => {
        const new_input = document.createElement('input');
        new_input.type = 'hidden';
        new_input.name = 'items';
        new_input.value = item;
        confirmation_form.querySelector('.modal-body').insertBefore(new_input, confirmation_text);
    });
    const del_checkbox = confirmation_form.querySelector('div.form-check#force-delete');

    if (selected_option.value == 'copy' || selected_option.value == 'move') {
        offcanvas.offcanvas.querySelectorAll('i.bi-folder-symlink-fill').forEach((i) => i.remove());
        if (del_checkbox != undefined) {
            del_checkbox.remove();
        }
        
        const action = selected_option.value == 'copy' ? 'copied' : 'moved';
        toast_message = selected_option.value == 'copy' && n_collections > 0
            ? `${n_dobjects_printed} will be ${action} to "DESTINATION". Copying collections is not supported.`
            : `${n_items} will be ${action} to "DESTINATION."`;

        offcanvas.toggle();
        offcanvas.link_data(selected_items, confirmation_text, confirmation_form, modal, selected_option.value, toast_message);
        offcanvas.update();

    } else {

        const del_checkbox = confirmation_form.querySelector('div.form-check#force-delete');
        if (del_checkbox == undefined) {
            confirmation_form.querySelector('input#destination').value = "";
            confirmation_modal.querySelector('p#confirmation-text').innerHTML = `${n_items} will be deleted.`;
            const del_checkbox = Field.quick('div', 'form-check');
            del_checkbox.id = 'force-checkbox';
            const checkbox_input = Field.quick('input', 'form-check-input');
            checkbox_input.type = 'checkbox';
            checkbox_input.name = 'force_delete';
            checkbox_input.value = true;
            del_checkbox.appendChild(checkbox_input);
            checkbox_label = Field.quick('label', 'form-check-label', 'Delete permanently');
            checkbox_label.setAttribute('for', 'force-checkbox');
            del_checkbox.appendChild(checkbox_label);
            confirmation_form.querySelector('div.modal-body').insertBefore(del_checkbox, confirmation_text);
        } else {
            del_checkbox.removeAttribute('checked');
        }
        modal.show()

    }
}

class OffCanvas {
    constructor(id) {
        this.offcanvas = Field.quick('div', 'offcanvas offcanvas-end');
        this.offcanvas.id = id;
        this.offcanvas.tabIndex = '-1';
        this.offcanvas.setAttribute('aria-labelledby', 'offcanvas-label');
        this.offcanvas.setAttribute('data-bs-backdrop', 'static');
        this.add_header();
        this.add_body();

    }

    toggle() {
        this.bootstrap = new bootstrap.Offcanvas(this.offcanvas);
        this.bootstrap.toggle();
    }

    add_header() {
        const offcanvas_header = Field.quick('quick', 'offcanvas-header');

        const offcanvas_h5 = Field.quick('h5', 'offcanvas-label', 'Select destination collection');
        offcanvas_h5.id = 'offcanvas-label';
        offcanvas_header.appendChild(offcanvas_h5);

        const offcanvas_close = Field.quick('button', 'btn-close');
        offcanvas_close.type = 'button';
        offcanvas_close.setAttribute('data-bs-dismiss', 'offcanvas');
        offcanvas_close.setAttribute('aria-label', 'Close');
        offcanvas_header.appendChild(offcanvas_close);

        this.offcanvas.appendChild(offcanvas_header);
    }

    add_body() {
        this.body = Field.quick('form', 'offcanvas-body offcanvas-tree');
        this.offcanvas.appendChild(this.body);
    }

    append_to(container) {
        container.appendChild(this.offcanvas);
    }
    link_data(selected_items, confirmation_text, confirmation_form, modal, selected_option, message) {
        this.selected_items = selected_items;
        this.confirmation_text = confirmation_text;
        this.confirmation_form = confirmation_form;
        this.modal = modal;
        this.selected_option = selected_option;
        this.message = message;
    }

    update_radios() {
        this.offcanvas.querySelectorAll('input[type="radio"]')
        .forEach((input) => input.addEventListener('change', () => {
            this.offcanvas.querySelectorAll('i.bi-folder-symlink-fill')
                .forEach((i) => i.remove());
            // parent_folders == 0 if the destination folder is not the direct parent of a selected collection
            let parent_folders = this.selected_items.filter((c) => {
                let regex_match = c.match('^(?<prefix>col-)(?<parent>.+)/(?<name>[^/]+)/?$');
                return regex_match != null && regex_match.groups.parent == input.value;
            }).length;
            
            // parent_of_dobj == 0 if the destination folder is not the direct parent of a selected data object
            let parent_of_dobj = this.selected_items.filter((d) => {
                let regex_match = d.match('^(?<prefix>dobj-)(?<parent>.+)/(?<name>[^/]+)$');
                return regex_match != null && regex_match.groups.parent == input.value
            }).length;

            // child_folders == 0 if the destination folder is not a child of a selected collection
            let child_folders = this.selected_items.filter((c) => {
                return c.startsWith('col-') && input.value.startsWith(c.match('(?<prefix>col-)(?<path>.+)').groups.path)
            }).length;

            if (parent_folders + child_folders == 0 && (this.selected_option == 'copy' || parent_of_dobj == 0)) {
                const icon = document.createElement('i');
                icon.className = 'bi bi-folder-symlink-fill ms-2';
                icon.setAttribute('style', 'font-size:1.2rem;');
                input.nextSibling.appendChild(icon);
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    const destination = input.value;
                    this.confirmation_text.innerHTML = this.message.replace('DESTINATION', destination);
                    this.confirmation_form.querySelector('input#destination').value = destination;
                    this.modal.show();
                });
            }

        }));
    }

    update() {
        this.offcanvas.addEventListener('shown.bs.offcanvas', () => {
            if (this.offcanvas.querySelectorAll('input[type="radio"]').length == 0) {
                top_tree.fill();
            }
            this.update_radios();

            this.offcanvas.querySelectorAll('.collapse.show').forEach((collapsible) => {
                bootstrap.Collapse.getOrCreateInstance(collapsible).toggle();
            });
        });
        if (this.offcanvas.classList.contains('show')) {
            this.update_radios();
        }
    }
}

class TreeElement {
    constructor(button_group, path = '') {
        this.url = urls.getAttribute('tree') + path;
        this.button_group = button_group;
        this.spinner = button_group.querySelector('div#spinner-div');
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => this.build_tree(xhr.responseText));
        xhr.open('GET', this.url, false);
        this.xhr = xhr;
    }

    fill() {
        this.xhr.send();
    }

    build_tree(text) {
        const { path, name, children } = JSON.parse(text);
        this.has_children = children.length > 0;
        if (this.has_children) {
            this.children = children;
        }
        this.path = path;
        this.id = path.replaceAll('/', '-').replaceAll(" ", "__");
        this.value = path;
        this.name = name;
        this.input = this.create_input();
        this.label = this.create_label();
        this.spinner.remove();
        this.append_to(this.button_group);
    }

    append_to(parent_element) {
        parent_element.appendChild(this.input);
        parent_element.appendChild(this.label);
        if (this.children != undefined) {
            const collapse = this.create_collapse();
            parent_element.appendChild(collapse);
        }
    }

    create_input() {
        const input = Field.quick('input', 'btn-check');
        input.type = 'radio';
        input.name = 'destination';
        input.id = this.id + '-radio';
        input.value = this.value;
        input.setAttribute('autocomplete', 'off');
        if (this.has_children) {
            input.setAttribute('data-bs-toggle', 'collapse');
            input.setAttribute('data-bs-target', `#${this.id}-collapse`);
            input.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-controls', this.id + '-collapse');
        }

        return input;
    }

    create_label() {
        const label = Field.quick('label', 'btn btn-oc text-start');
        label.setAttribute('for', this.id + '-radio');
        const collection_name = document.createElement('span');
        collection_name.innerHTML = this.name;
        label.appendChild(collection_name);

        if (this.has_children) {
            let icon = Field.quick('i', 'bi bi-caret-right-fill me-2');
            label.insertBefore(icon, collection_name);
        }

        return label;
    }

    create_collapse() {
        if (!this.has_children) {
            return;
        }
        let children_requested = false;

        const collapse = Field.quick('div', 'collapse ps-3 w-100');
        collapse.id = this.id + '-collapse';
        const icon = this.label.querySelector('i.bi');

        const sub_button_group = TreeElement.create_button_group();
        collapse.appendChild(sub_button_group);

        this.branches = this.children.map((tree_element) => new TreeElement(sub_button_group, tree_element.path));

        // the events below have an if statement because otherwise the icons of
        // the parent folders also change
        collapse.addEventListener('shown.bs.collapse', () => {
            if (collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-right-fill', 'bi-caret-down-fill');
            }
            if (!children_requested) {
                this.branches.forEach((tree_element) => {
                    tree_element.fill();
                });
            }
            offcanvas.update();
            children_requested = true;

        });

        collapse.addEventListener('hidden.bs.collapse', () => {
            if (!collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-down-fill', 'bi-caret-right-fill');
            }
        });


        return collapse;
    }

    static create_spinner() {
        let spinner_div = Field.quick('div', 'd-flex justify-content-center');
        spinner_div.id = 'spinner-div';

        let spinner = Field.quick('div', 'spinner-border spinner-border-sm text-primary');
        spinner.role = 'status';
        spinner_div.appendChild(spinner);

        let spinner_span = Field.quick('span', 'text-muted ms-3', 'Loading tree...');
        spinner_div.appendChild(spinner_span);

        return spinner_div;
    }

    static create_button_group() {
        const button_group = Field.quick('div', 'btn-group-vertical w-100');
        button_group.role = 'group';
        button_group.setAttribute('aria-label', 'Collection tree to select destination');

        button_group.appendChild(TreeElement.create_spinner());
        return button_group;
    }
}

const offcanvas = new OffCanvas('collection-tree');
const button_group = TreeElement.create_button_group();
offcanvas.body.appendChild(button_group);
offcanvas.append_to(document.getElementById('collection-content'));

const top_tree = new TreeElement(button_group);
