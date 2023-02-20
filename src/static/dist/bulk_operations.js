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
            console.log(`File "${checkbox.value}" has been selected.`);
            go_button.removeAttribute('disabled');
            if (are_checked == 1) {
                select_all.parentElement.appendChild(badge_counter)
            }
            if (are_checked == tbody_checkboxes.length) {
                select_all.checked = true;
            }
        } else {
            console.log(`File "${checkbox.value}" has been unselected.`);
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

    const previous_toasts = [...document.querySelectorAll('div.toast')]
        .filter((div) => div.id.startsWith(selected_option.value));
    const toast_id = `${selected_option.value}-items-${previous_toasts.length}`;
    
    const form_data = new FormData();
    form_data.append('action', selected_option.value);
    const items_to_send = selected_option.value == 'copy'
        ? selected_items.filter((c) => c.startsWith('dobj-'))
        : selected_items;                            
    items_to_send.forEach((item) => form_data.append('items', item));
    
                            
    if (selected_option.value == 'copy' || selected_option.value == 'move') {
        const offcanvas_dom = document.querySelector('.offcanvas#collection-tree');
        offcanvas_dom.querySelectorAll('i.bi-folder-symlink-fill').forEach((i) => i.remove());
        const offcanvas = new bootstrap.Offcanvas(offcanvas_dom);
        offcanvas_dom.querySelectorAll('input[type="radio"]')
            .forEach((input) => input.addEventListener('change', () => {
                offcanvas_dom.querySelectorAll('i.bi-folder-symlink-fill')
                    .forEach((i) => i.remove());
                // parent_folders == 0 if the destination folder is not the direct parent of a selected folder
                parent_folders = selected_items.filter((c) => c.startsWith('col-' + input.value)).length;
                // child_folders == 0 if the destination folder is not a child of a selected folder
                child_folders = selected_items.filter((c) => {
                    return c.startsWith('col-') && input.value.startsWith(c.match('(?<prefix>col-)(?<path>.+)').groups.path)
                }).length;
                if (parent_folders + child_folders == 0) {
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-folder-symlink-fill ms-2';
                    icon.setAttribute('style', 'font-size:1.2rem;');
                    input.nextSibling.appendChild(icon);
                    icon.addEventListener('click', (e) => {
                        e.preventDefault();
                        const action = selected_option.value == 'copy' ? 'copied' : 'moved';
                        const destination = input.value;
                        toast_message = selected_option.value == 'copy' && n_collections > 0
                            ? `${n_dobjects_printed} will be ${action} to "${destination}. Copying collections is not supported."`
                            : `${n_items} will be ${action} to "${destination}."`
                        const toast = new Toast(toast_id, toast_message);
                        toast.show(() => {
                            form_data.append('destination', destination);
                            
                            const xhr = new XMLHttpRequest();
                            xhr.open('POST', urls.getAttribute('post'), true);
                            xhr.send(form_data);

                            offcanvas.toggle();
                            select_all.checked = false;
                            tbody_checkboxes.forEach((c) => c.checked = false);
                            go_button.setAttribute('disabled', '');
                            select_all.parentElement.removeChild(badge_counter);
                            location.reload();
                        });
                    });
                }

            }));
        offcanvas.toggle();
        offcanvas_dom.querySelectorAll('.collapse.show').forEach((collapsible) => {
            bootstrap.Collapse.getOrCreateInstance(collapsible).toggle();
        });

    } else {
        const toast = new Toast(toast_id, `${n_items} will be deleted.`);
        const toast_body = toast.div.querySelector('div.toast-body');
        const force_checkbox = Field.quick('div', 'form-check');
        const checkbox_input = Field.quick('input', 'form-check-input');
        checkbox_input.type = 'checkbox';
        checkbox_input.id = 'force-checkbox';
        force_checkbox.appendChild(checkbox_input);
        checkbox_label = Field.quick('label', 'form-check-label', 'Delete permanently');
        checkbox_label.setAttribute('for', 'force-checkbox');
        force_checkbox.appendChild(checkbox_label);

        toast_body.insertBefore(force_checkbox, toast_body.querySelector('div.row'));
        toast.show(() => {
            form_data.set('action', checkbox_input.checked ? 'force_delete' : 'delete');
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', urls.getAttribute('post'), true);
            xhr.send(form_data);

            select_all.checked = false;
            tbody_checkboxes.forEach((c) => c.checked = false);
            go_button.setAttribute('disabled', '');
            select_all.parentElement.removeChild(badge_counter);
            location.reload();
        });
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
}

class TreeElement {
    constructor({ id, label, children = undefined } = {}) {
        this.has_children = children != undefined;
        if (this.has_children) {
            this.children = children;
        }
        this.id = id.replaceAll('/', '-');
        this.value = id;
        this.label_name = label;
        this.input = this.create_input();
        this.label = this.create_label();
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
        collection_name.innerHTML = this.label_name;
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

        const collapse = Field.quick('div', 'collapse ps-3 w-100');
        collapse.id = this.id + '-collapse';
        const icon = this.label.querySelector('i.bi');

        // the events below have an if statement because otherwise the icons of
        // the parent folders also change
        collapse.addEventListener('shown.bs.collapse', () => {
            if (collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-right-fill', 'bi-caret-down-fill');
            }
        });

        collapse.addEventListener('hidden.bs.collapse', () => {
            if (!collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-down-fill', 'bi-caret-right-fill');
            }
        });

        const sub_button_group = TreeElement.create_button_group();
        collapse.appendChild(sub_button_group);

        this.children.forEach((tree_element) => {
            new TreeElement(tree_element).append_to(sub_button_group);
        });

        return collapse;
    }

    static create_button_group() {
        const button_group = Field.quick('div', 'btn-group-vertical w-100');
        button_group.role = 'group';
        button_group.setAttribute('aria-label', 'Collection tree to select destination');
        return button_group;
    }
}

const offcanvas = new OffCanvas('collection-tree');
const button_group = TreeElement.create_button_group();
offcanvas.body.appendChild(button_group);
offcanvas.append_to(document.getElementById('collection-content'));

var xhr = new XMLHttpRequest();
function create_tree() {
    const tree = JSON.parse(this.responseText);
    tree.forEach((tree_element) => {
        new TreeElement(tree_element).append_to(button_group);
    });
}
xhr.addEventListener('load', create_tree);
xhr.open("GET", urls.getAttribute('tree'));
xhr.send();

