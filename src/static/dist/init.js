const container_id = 'metadata_template_list_container';
const container = document.getElementById(container_id);

container.className = 'accordion accordion-flush';
// first the button
let starting_schema = new Schema('schema-editor', container_id);
starting_schema.create_creator();

let url_tag = document.getElementsByTagName('url-list')[0];
let url_list = url_tag.attributes;
let urls = {};
for (let url of url_list) {
	urls[url.name] = url.value;
}
url_tag.remove();

// function reqPrinter() {
// 	console.log(JSON.parse(this.responseText));
// }

// get all templates
// const req = new XMLHttpRequest();
// function reqListener() {
// 	let templates = JSON.parse(this.responseText);
// 	console.log('templates: ', templates);
// 	for (let template of templates) {
// 		let name = template.name.replace('.json', '');
// 		let template_card = new AccordionItem(name, name + ' schema', 'metadata_template_list_container');
// 		let card_text = `Here you can edit the <em>${name}</em> schema; its url is <code>${template.url}</code>.`;
// 		let card_contents = Field.quick('p', 'mb-2', card_text); // with new Schema() or whatever
// 		template_card.append(card_contents);
// 		container.appendChild(template_card.div);
// 	}
// 	const temp_url = '/static/metadata-templates/basic.json';
// 	const schema_rq = new XMLHttpRequest();
// 	schema_rq.addEventListener('load', reqPrinter);
// 	schema_rq.open('GET', temp_url);
// 	schema_rq.send();
// }

// req.addEventListener("load", reqListener);
// req.open("GET", urls.list); // should be replaced with a variable from the template (?)
// req.send();


// get one template
const temp_url = '/static/metadata-templates/basic.json';
function read_schema() {
	let response = JSON.parse(this.responseText);
	console.log(response);
	let schema = new Schema('basic', container_id);
	schema.from_json(response);
	schema.view();
}

const schema_rq = new XMLHttpRequest();
schema_rq.addEventListener('load', read_schema);
schema_rq.open('GET', temp_url);
schema_rq.send();
