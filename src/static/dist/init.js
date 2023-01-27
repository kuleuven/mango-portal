const container_id = 'metadata_template_list_container';
const container = document.getElementById(container_id);

let url_tag = document.getElementsByTagName('url-list')[0];
let url_list = url_tag.attributes;
let urls = {};
for (let url of url_list) {
	urls[url.name] = url.value;
}
url_tag.remove();

container.className = 'accordion accordion-flush';
// first the button
let starting_schema = new Schema('schema-editor', container_id, urls.new);
starting_schema.create_creator('1.0.0');

let templates_request = new TemplatesRequest(urls, container_id);
templates_request.retrieve();
