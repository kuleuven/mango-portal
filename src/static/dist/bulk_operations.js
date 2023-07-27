// This script is used by the collection_view.html.j2 template

//#region Constants
/** Body of the table with the contents of the collection. */
const tbody = document.querySelector('#browseTable tbody');
/** Selection of all the checkboxes inside the body of the table (which excludes the header!). */
const tbody_checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
/** Small badge that shows the number of selected items if there is any. */
const badge_counter = document.querySelector('#browseTable thead span.badge');
/** Button ("apply") to trigger the action selected in the dropdown. */
const go_button = document.querySelector('#collection-content button');
/** One checkbox to rule them all (it's in the header of the table). */
const select_all = document.querySelector('#browseTable input#select_all');
/** Custom DOM element that contains the url to call the top tree. */
const urls = document.querySelector('bulk-links');
//#endregion

//#region Listeners
/** Behavior of the checkbox that rules all other checkboxes. */
select_all.addEventListener('change', () => {
    if (select_all.checked) {
        // When this checkbox is checked
        tbody_checkboxes.forEach((el) => el.checked = true); // all other checkboxes are checked
        go_button.removeAttribute('disabled'); // the button to trigger the action is enabled
        if (select_all.parentElement.querySelector('span.badge') == null) {
            // the counter badge is shown if not visible yet
            select_all.parentElement.appendChild(badge_counter);
        }
        badge_counter.innerHTML = tbody_checkboxes.length; // the counter badge is updated
    } else {
        // When this checkbox is unchecked
        tbody_checkboxes.forEach((el) => el.checked = false); // all other checkboxes are unchecked
        go_button.setAttribute('disabled', ''); // the button to trigger the action is disabled
        select_all.parentElement.removeChild(badge_counter); // the counter badge is removed altogether
    }
});

/** Behavior of the checkboxes in the body of the table. */
tbody_checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        /** Number of already checked checkboxes. */
        let are_checked = [...tbody_checkboxes].filter((c) => c.checked).length;
        badge_counter.innerHTML = are_checked; // update badge counter
        if (checkbox.checked) {
            // when the checkbox is checked
            go_button.removeAttribute('disabled'); // enable actions
            // add or update badge counter
            if (are_checked == 1) {
                select_all.parentElement.appendChild(badge_counter)
            }
            if (are_checked == tbody_checkboxes.length) {
                select_all.checked = true;
            }
        } else {
            // when the checkbox is unchecked
            select_all.checked = false; // make sure that the header checkbox is unchecked
            if (are_checked == 0) { // update button and badge if no other checkboxes are checked
                go_button.setAttribute('disabled', '');
                select_all.parentElement.removeChild(badge_counter);
            }
        }
    })
});

//#endregion

//#region Main function
/** Function called when clicking on the 'apply' button to trigger an action (copy/move/delete/download). */
function apply_bulk_operation() {
    /** Option chosen in the dropdown. */
    const selected_option = document.querySelector('#collection-content select');

    /** Array of paths to apply the action upon. */
    const selected_items = [...tbody_checkboxes].filter((c) => c.checked).map((c) => c.value);
    /** Number of collections selected. */
    const n_collections = selected_items.filter((c) => c.startsWith('col-')).length;
    /** Number of data objects selected. */
    const n_dobjects = selected_items.filter((c) => c.startsWith('dobj-')).length;

    /** Message to print indicating the number of collections. */
    const n_collections_printed = `${n_collections} collection${n_collections > 1 ? "s" : ""}`;
    /** Message to print indicating the number of data objects. */
    const n_dobjects_printed = `${n_dobjects} data object${n_dobjects > 1 ? "s" : ""}`;
    /** Message to print combining the number of collections and data objects. */
    const n_items = n_collections == 0 // if there are only objects
        ? n_dobjects_printed
        : n_dobjects == 0 // if there are only collections
            ? n_collections_printed
            : `${n_collections_printed} and ${n_dobjects_printed}`;

    /**
     * Modal with a confirmation dialog with a form to submit the action (defined in the template).
     * It includes a form to post the chosen action, the array of paths, and if relevant the destination.
    */
    const confirmation_modal = document.querySelector('div.modal#confirmation-dialog');
    /** Modal as bootstrap Modal instance. */
    const modal = bootstrap.Modal.getOrCreateInstance(confirmation_modal);
    /** Form within the modal. */
    const confirmation_form = confirmation_modal.querySelector('form#confirmation-form');
    // Update the form with the chosen action (copy/move/delete).
    confirmation_form.querySelector('input#action').value = selected_option.value;
    /** Text to return in the confirmation dialog */
    const confirmation_text = confirmation_form.querySelector('p#confirmation-text')

    confirmation_form.addEventListener("submit", ()=> { 
        modal.hide();
        tbody_checkboxes.forEach((el) => el.checked = false); // uncheck all checkboxes
        go_button.setAttribute('disabled', ''); // the button to trigger the action is disabled
        select_all.parentElement.removeChild(badge_counter); // the counter badge is removed altogether
        select_all.checked = false; // uncheck also the global select/unselect all
    })


    /** Final list of items to act upon: exclude collections if the action is 'copy'. */
    const items_to_send = selected_option.value == 'copy'
        ? selected_items.filter((c) => c.startsWith('dobj-'))
        : selected_items;

    // Update form with the list of items
    // First remove any items from previous attempts if they exist
    const existing_items = confirmation_form.querySelectorAll('input[name="items"]');
    if (existing_items.length > 0) {
        existing_items.forEach((x) => x.remove());
    }
    // Create a hidden input for each of the items
    items_to_send.forEach((item) => {
        const new_input = document.createElement('input');
        new_input.type = 'hidden';
        new_input.name = 'items';
        new_input.value = item;
        confirmation_form.querySelector('.modal-body').insertBefore(new_input, confirmation_text);
    });
    /** Checkbox to force delete items. */
    const del_checkbox = confirmation_form.querySelector('div.form-check#force-delete');

    // ACT
    if (selected_option.value == 'copy' || selected_option.value == 'move') {
        // if items will be copied or moved
        // clean the folder icons of the offcanvas (which is defined at the bottom of this script.)
        offcanvas.offcanvas.querySelectorAll('i.bi-folder-symlink-fill').forEach((i) => i.remove());
        // delete the force-delete checkbox from the confirmation dialog if it exists
        if (del_checkbox != undefined) {
            del_checkbox.remove();
        }

        /** Text of the chosen action for the dialog message. */
        const action = selected_option.value == 'copy' ? 'copied' : 'moved';
        /** Message to provide in the confirmation dialog. */
        const toast_message = selected_option.value == 'copy' && n_collections > 0
            ? `${n_dobjects_printed} will be ${action} to "DESTINATION". Copying collections is not supported.`
            : `${n_items} will be ${action} to "DESTINATION."`;

        offcanvas.toggle(); // call the offcanvas
        // link the current information to the offcanvas instance
        offcanvas.link_data(selected_items, confirmation_text, confirmation_form, modal, selected_option.value, toast_message);
        // update the offcanvas
        offcanvas.update();

    } else if (selected_option.value == 'download') {
        // delete the force-delete checkbox from the confirmation dialog if it exists
        if (del_checkbox != undefined) {
            del_checkbox.remove();
        }
        confirmation_form.querySelector('input#destination').value = "";
        confirmation_modal.querySelector('p#confirmation-text').innerHTML = `${n_dobjects_printed} will be downloaded.`;
        modal.show() // show confirmation modal

    } else {
        // if the items will be deleted
        if (del_checkbox == undefined) {
            // if there is no force-delete checkbox
            confirmation_form.querySelector('input#destination').value = ""; // don't send a destination value
            confirmation_modal.querySelector('p#confirmation-text').innerHTML = `${n_items} will be deleted.`; // update message

            // create force-delete checkbox and add it to the form
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
            // all the actions from before have already been done
            del_checkbox.removeAttribute('checked');
        }
        modal.show() // show confirmation modal
    }
}
//#endregion

//#region Class definitions
/**
 * Class representing the offcanvas with the list of collections to copy/move items to.
 * @property {HTMLDivElement} offcanvas OffCanvas used to select the destination collection.
 * @property {Offcanvas} bootstrap Bootstrap Offcanvas instance of the offcanvas.
 * @property {HTMLFormElement} body Form in the body of the offcanvas.
 * @property {String[]} selected_items Array of paths to apply the action to.
 * @property {HTMLParagraphElement} confirmation_text DOM element where the confirmation message will be printed.
 * @property {HTMLFormElement} confirmation_form DOM element with the form to post the action.
 * @property {Modal} modal Bootstrap Modal instance of the confirmation dialog modal.
 * @property {String} selected_option Action to perform.
 * @property {String} message Message to add to the confirmation dialog.
 */
class OffCanvas {
    /**
     * Initialize the offcanvas.
     * @class
     * @param {String} id ID of the offcanvas.
     */
    constructor(id) {
        // create the offcanvas element
        this.offcanvas = Field.quick('div', 'offcanvas offcanvas-end');
        this.offcanvas.id = id;
        this.offcanvas.tabIndex = '-1';
        this.offcanvas.setAttribute('aria-labelledby', 'offcanvas-label');
        this.offcanvas.setAttribute('data-bs-backdrop', 'static');
        this.add_header(); // create the header, with title and dismiss button
        this.add_body(); // create the body, which is a form

    }

    /** Show or hide the offcanvas. */
    toggle() {
        this.bootstrap = new bootstrap.Offcanvas(this.offcanvas);
        this.bootstrap.toggle();
    }

    /** Create and append the header of the offcanvas */
    add_header() {
        /** Div for the header */
        const offcanvas_header = Field.quick('div', 'offcanvas-header');

        /** Title of the header */
        const offcanvas_h5 = Field.quick('h5', 'offcanvas-label', 'Select destination collection');
        offcanvas_h5.id = 'offcanvas-label';
        offcanvas_header.appendChild(offcanvas_h5);

        /** Close button to dismiss offcanvas */
        const offcanvas_close = Field.quick('button', 'btn-close');
        offcanvas_close.type = 'button';
        offcanvas_close.setAttribute('data-bs-dismiss', 'offcanvas');
        offcanvas_close.setAttribute('aria-label', 'Close');
        offcanvas_header.appendChild(offcanvas_close);

        this.offcanvas.appendChild(offcanvas_header);
    }

    /** Create and append the body of the offcanvas */
    add_body() {
        this.body = Field.quick('form', 'offcanvas-body offcanvas-tree');
        this.offcanvas.appendChild(this.body);
    }

    /**
     * Append the offcanvas div element to some container.
     * @param {HTMLElement} container Element to append the offcanvas to.
     */
    append_to(container) {
        container.appendChild(this.offcanvas);
    }

    /**
     * Fill properties of the offcanvas with information selected by the user and
     * data for the confirmation dialog.
     * 
     * @param {String[]} selected_items Array of paths to apply the action to.
     * @param {HTMLParagraphElement} confirmation_text DOM element where the confirmation message will be printed.
     * @param {HTMLFormElement} confirmation_form DOM element with the form to post the action.
     * @param {Modal} modal Bootstrap Modal instance of the confirmation dialog modal.
     * @param {String} selected_option Action to perform.
     * @param {String} message Message to add to the confirmation dialog.
     */
    link_data(selected_items, confirmation_text, confirmation_form, modal, selected_option, message) {
        this.selected_items = selected_items;
        this.confirmation_text = confirmation_text;
        this.confirmation_form = confirmation_form;
        this.modal = modal;
        this.selected_option = selected_option;
        this.message = message;
    }

    /** Update the behavior of the radio inputs in the offcanvas based on the current selected items and action. */
    update_radios() {
        // apply to all radio inputs in the offcanvas
        this.offcanvas.querySelectorAll('input[type="radio"]')
            .forEach((input) => input.addEventListener('change', () => {
                // INPUT represents a radio input and thus a candidate destination folder
                // remove all existing folder icons (we only show it for INPUT, iff it's an acceptable destination)
                this.offcanvas.querySelectorAll('i.bi-folder-symlink-fill')
                    .forEach((i) => i.remove());

                // check which collections can be destinations
                // parent_folders == 0 if the INPUT is not the direct parent of a selected collection
                let parent_folders = this.selected_items.filter((c) => {
                    let regex_match = c.match('^(?<prefix>col-)(?<parent>.+)/(?<name>[^/]+)/?$');
                    return regex_match != null && regex_match.groups.parent == input.value;
                }).length;

                // parent_of_dobj == 0 if the INPUT is not the direct parent of a selected data object
                let parent_of_dobj = this.selected_items.filter((d) => {
                    let regex_match = d.match('^(?<prefix>dobj-)(?<parent>.+)/(?<name>[^/]+)$');
                    return regex_match != null && regex_match.groups.parent == input.value
                }).length;

                // child_folders == 0 if the INPUT is not a child of a selected collection
                let child_folders = this.selected_items.filter((c) => {
                    return c.startsWith('col-') && input.value.startsWith(c.match('(?<prefix>col-)(?<path>.+)').groups.path)
                }).length;

                if (parent_folders + child_folders == 0 && (this.selected_option == 'copy' || parent_of_dobj == 0)) {
                    // if INPUT is not a parent or child of a selected collection AND either we are copying or it's not a parent of a selected data object

                    /** Icon to select INPUT as destination. */
                    const icon = document.createElement('i');
                    icon.className = 'bi bi-folder-symlink-fill ms-2';
                    icon.setAttribute('style', 'font-size:1.2rem;');
                    input.nextSibling.appendChild(icon);
                    icon.addEventListener('click', (e) => {
                        // when the icon is clicked
                        e.preventDefault();
                        const destination = input.value;
                        // update the confirmation message with the chosen destination
                        this.confirmation_text.innerHTML = this.message.replace('DESTINATION', destination);
                        // update the form to post with the chosen destination
                        this.confirmation_form.querySelector('input#destination').value = destination;
                        // show the confirmation dialog
                        this.modal.show();
                    });
                }

            }));
    }

    /** Update the behavior of the offcanvas when it is open. */
    update() {
        this.offcanvas.addEventListener('shown.bs.offcanvas', () => {
            // if no items have been shown yet, fill the tree (call the top tree)
            if (this.offcanvas.querySelectorAll('input[type="radio"]').length == 0) {
                top_tree.fill();
            }
            // update the behavior of the radio inputs
            this.update_radios();

            // collapse any section that may have been uncollapsed before
            this.offcanvas.querySelectorAll('.collapse.show').forEach((collapsible) => {
                bootstrap.Collapse.getOrCreateInstance(collapsible).toggle();
            });
        });

        // if the offcanvas is already shown when this method is called
        if (this.offcanvas.classList.contains('show')) {
            this.update_radios(); // update the behavior of the radio inputs
        }
    }
}

/**
 * Class representing a candidate destinations for moving/copying items.
 * 
 * @property {String} url URL to request information about this collection.
 * @property {HTMLDivElement} button_group DOM element where the radio input of this element will be added to.
 * @property {HTMLDivElement} spinner Spinner used as placeholder while the contents of the button group are loaded.
 * @property {XMLHttpRequest} xhr The request to the url, which then builds the tree with the contents of this collection.
 * @property {Boolean} has_children Whether the collection has subcollections.
 * @property {String[]} children If the collection has subcollections, their paths.
 * @property {String} path The path to the collection (as value for the radio input).
 * @property {String} id Modified path to use as part of the id of its DOM elements.
 * @property {String} value The value of the radio input (currently the same as the path).
 * @property {String} name The name of the collection, for the label of the radio input.
 * @property {HTMLInputElement} input Radio input.
 * @property {HTMLElement} label Label of the radio input.
 * @property {TreeElement[]} branches Instances of TreeElement for the children of this collection.
 */
class TreeElement {
    /**
     * Instantiate the class to show and request information about a candidate destination.
     * @param {HTMLDivElement} button_group DOM element where the radio input of this element will be added to.
     * @param {String} path Path of the collection to be added to the url.
     */
    constructor(button_group, path = '') {
        this.url = urls.getAttribute('tree') + path; // note: urls is defined at the top of this script
        this.button_group = button_group;
        this.spinner = button_group.querySelector('div#spinner-div');
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => this.build_tree(xhr.responseText));
        xhr.open('GET', this.url, false);
        this.xhr = xhr;
    }

    /** Request information about the destination collection. */
    fill() {
        this.xhr.send();
    }

    /**
     * Create the appropriate radio input for this collection.
     * @param {String} text Response of the request about the destination collection.
     */
    build_tree(text) {
        const { path, name, children } = JSON.parse(text);
        this.has_children = children.length > 0;
        if (this.has_children) {
            this.children = children;
        }
        // Define variables for the radio input based on the information retrieved from the server
        this.path = path;
        this.id = path.replaceAll('/', '-').replaceAll(" ", "__");
        this.value = path;
        this.name = name;
        // Create radio input and its label
        this.input = this.create_input();
        this.label = this.create_label();
        // Remove the spinner, since we are ready to show the radio button
        this.spinner.remove();
        // Append input and label to the button group this belongs to
        this.append_to(this.button_group);
    }

    /**
     * Append the radio input representing this collection to the tree in the offcanvas.
     * @param {HTMLDivElement} parent_element Button group to which the radio input should be appended.
     */
    append_to(parent_element) {
        parent_element.appendChild(this.input);
        parent_element.appendChild(this.label);
        if (this.children != undefined) {
            // If the collection has subcollections, create the appropriate collapsible and add it as well.
            const collapse = this.create_collapse();
            parent_element.appendChild(collapse);
        }
    }

    /** Create the radio input */
    create_input() {
        const input = Field.quick('input', 'btn-check');
        input.type = 'radio';
        input.name = 'destination';
        input.id = this.id + '-radio';
        input.value = this.value;
        input.setAttribute('autocomplete', 'off');
        if (this.has_children) {
            // If the collection has subcollections, make the radio input trigger the collapsible with the children
            input.setAttribute('data-bs-toggle', 'collapse');
            input.setAttribute('data-bs-target', `#${this.id}-collapse`);
            input.setAttribute('aria-expanded', 'false');
            input.setAttribute('aria-controls', this.id + '-collapse');
        }

        return input;
    }

    /** Create the label for the radio input */
    create_label() {
        const label = Field.quick('label', 'btn btn-oc text-start');
        label.setAttribute('for', this.id + '-radio'); // link label to the radio input
        const collection_name = document.createElement('span');
        collection_name.innerHTML = this.name;
        label.appendChild(collection_name);

        if (this.has_children) {
            // If the collection has subcollections, add the caret icon
            let icon = Field.quick('i', 'bi bi-caret-right-fill me-2');
            label.insertBefore(icon, collection_name);
        }

        return label;
    }

    /** Create the collapsible with the children of this collection */
    create_collapse() {
        if (!this.has_children) {
            // If the collection does not have subcollections, don't do anything
            return;
        }
        /** Whether we have information from the children already (have we ever shown them) */
        let children_requested = false;

        /** Collapsible div */
        const collapse = Field.quick('div', 'collapse ps-3 w-100');
        collapse.id = this.id + '-collapse';

        /** Caret icon of the label (indicating whether the selection of children is collapsed or not) */
        const icon = this.label.querySelector('i.bi');

        /** New button group for the children of this collection */
        const sub_button_group = TreeElement.create_button_group();
        collapse.appendChild(sub_button_group);

        /** Set up the tree elements for each of the children, with the new button group and the parent path. */
        this.branches = this.children.map((tree_element) => new TreeElement(sub_button_group, tree_element.path));

        // the events below have an if statement because otherwise the icons of the parent folders also change
        collapse.addEventListener('shown.bs.collapse', () => {
            // when the collapsible is shown
            if (collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-right-fill', 'bi-caret-down-fill'); // update the direction of the caret icon
            }
            if (!children_requested) {
                // if we have never asked for information of the children, do so
                this.branches.forEach((tree_element) => {
                    tree_element.fill();
                });
            }
            offcanvas.update(); // update all radio buttons
            children_requested = true; // after this, (un)collapsing the collapsible will not trigger the request because the buttons already exist

        });

        // update the direction of the caret icons when the collapsible is hidden
        collapse.addEventListener('hidden.bs.collapse', () => {
            if (!collapse.classList.contains('show')) {
                icon.classList.replace('bi-caret-down-fill', 'bi-caret-right-fill');
            }
        });

        return collapse;
    }

    /** Create and return a div with a spinner for when we wait for information on a collection. */
    static create_spinner() {
        /** Div of the spinner. */
        let spinner_div = Field.quick('div', 'd-flex justify-content-center');
        spinner_div.id = 'spinner-div';

        /** Spinner itself. */
        let spinner = Field.quick('div', 'spinner-border spinner-border-sm text-primary');
        spinner.role = 'status';
        spinner_div.appendChild(spinner);

        /** Muted text of the spinner. */
        let spinner_span = Field.quick('span', 'text-muted ms-3', 'Loading tree...');
        spinner_div.appendChild(spinner_span);

        return spinner_div;
    }

    /** Create and return a button group for collections within the same collection */
    static create_button_group() {
        const button_group = Field.quick('div', 'btn-group-vertical w-100');
        button_group.role = 'group';
        button_group.setAttribute('aria-label', 'Collection tree to select destination');

        button_group.appendChild(TreeElement.create_spinner()); // add spinner by default
        return button_group;
    }
}
//#endregion

// Create offcanvas and generate tree ============================================================

// Instantiate OffCanvas with 'collection-tree' as ID.
const offcanvas = new OffCanvas('collection-tree');

// Create the button group for the top level element(s) to show in the offcanvas
const button_group = TreeElement.create_button_group();
// Add the button group to the offcanvas
offcanvas.body.appendChild(button_group);
// Add the offcanvas to the template
offcanvas.append_to(document.getElementById('collection-content'));

// Instantiate a TreeElement that will be filled with the top collection(s) provided by the url in 'bulk-links'
const top_tree = new TreeElement(button_group);
