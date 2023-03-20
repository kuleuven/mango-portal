const container_id = 'metadata_template_list_container';
const container = document.getElementById(container_id);
container.className = 'accordion accordion-flush';

let url_tag = document.getElementsByTagName('url-list')[0];
let url_list = url_tag.attributes;
let urls = {};
for (let url of url_list) {
	urls[url.name] = url.value;
}
url_tag.remove();
const realm = urls.realm;

const schemas = {};
let schema_pattern = "[a-z0-9-_]+";

// first the button
let starting_schema = new Schema('schema-editor-100', container_id, urls);
starting_schema.create_creator();

let templates_request = new TemplatesRequest(urls, container_id);
templates_request.retrieve();

let toast_container = document.createElement('div');
toast_container.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
document.querySelector('body').appendChild(toast_container);
