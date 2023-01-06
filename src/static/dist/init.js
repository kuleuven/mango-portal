let container = document.getElementById('metadata_template_list_container');

container.className = 'accordion accordion-flush';
// first the button
let starting_schema = new Schema('schema-editor');
container.appendChild(starting_schema.accordion_item);

let url_tag = document.getElementsByTagName('url-list')[0];
let url_list = url_tag.attributes;
let urls = {};
for (let url of url_list) {
	urls[url.name] = url.value;
}
url_tag.remove();

const req = new XMLHttpRequest();
function reqListener() {
	let templates = JSON.parse(this.responseText);
	console.log('templates: ', templates);
	for (let template of templates) {
		let name = template.name.replace('.json', '');
		let template_card = new AccordionItem(name, name + ' schema', 'metadata_template_list_container');
		let card_text = `Here you can edit the <em>${name}</em> schema; its url is <code>${template.url}</code>.`;
		let card_contents = Field.quick('p', 'mb-2', card_text); // with new Schema() or whatever
		template_card.fill(card_contents);
		container.appendChild(template_card.div);
	}
}

req.addEventListener("load", reqListener);
req.open("GET", urls.list); // should be replaced with a variable from the template (?)
req.send();