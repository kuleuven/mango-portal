const container_id = 'metadata_form';
const container = document.getElementById(container_id);

let schema_url = container.getAttribute('schema-url');
let annotated_data = JSON.parse(container.getAttribute('schema-values'));
let prefix = container.getAttribute('prefix');

let ann = new AnnotationRequest(schema_url, annotated_data, prefix);
ann.retrieve();