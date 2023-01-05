let container = document.getElementById('metadata_template_list_container');

// let editing_schema = new Schema('schemaEditor');
// editing_schema.init_modal();
// let button = Field.quick('button', 'btn btn-primary', 'Create schema');
// button.id = 'new-schema';
// button.setAttribute('data-bs-toggle', 'modal');
// button.setAttribute('data-bs-target', '#schemaEditor');

// container.appendChild(button);

container.className = 'accordion accordion-flush';
// first the button
let starting_schema = new Schema('schema-editor');
container.appendChild(starting_schema.accordion_item);

// then the templates
let current_templates = ['animals', 'some-schema', 'another-template'];
for (template of current_templates) {
	let template_card = new AccordionItem(template, template + ' schema', 'metadata_template_list_container');
	let card_contents = Field.quick('p', 'mb-2', `Here you can edit the ${template} schema.`); // with new Schema() or whatever
    template_card.fill(card_contents);
	container.appendChild(template_card.div);
}
