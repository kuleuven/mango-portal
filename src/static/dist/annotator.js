/**
 * ID of the DOM element to hook the form to.
 * @type {String}
 */
const container_id = 'metadata_form';

/**
 * DOM element to hook the form to. It should also have several attributes with necessary info.
 * @type {HTMLElement}
 */
const container = document.getElementById(container_id);

let schema_url = container.getAttribute('schema-url'); // url to retrieve existing schema
let post_url = container.getAttribute('post-url'); // url to post metadata
let annotated_data = JSON.parse(atob(container.getAttribute('schema-values'))); // existing annotation
let prefix = container.getAttribute('prefix'); // prefix for AVU names

// request the information and start!
let ann = new AnnotationRequest(schema_url, annotated_data, prefix);
ann.retrieve();
