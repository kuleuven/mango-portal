class MangoRequest extends XMLHttpRequest {
    constructor(url) {
        super();
        this.url = url;
    }
    
    get json() {
        return JSON.parse(this.responseText);
    }

    retrieve() {
        this.open("GET", this.url);
        this.send();
    }
}

class TemplatesRequest extends MangoRequest {
    constructor(urls, container_id) {
        super(urls.list);
        this.parse_response(container_id, urls.new);
    }

    parse_response(container_id, url) {
        this.addEventListener('load', () => {
            let templates = this.json;
            templates.forEach((template) => template.schema_name = template.name.split('-v')[0]); // get schema names
            let template_names = [...new Set(templates.map((template) => template.schema_name))]; // get unique names
            let grouped_templates = template_names.map((schema) => ({
                schema_name : schema,
                template_list : templates
                    .filter((template) => template.schema_name == schema)
                    .sort((t1, t2) => (t1.name) > (t2.name) ? 1 : -1)
            })); // match unique names and versions
            for (let template of grouped_templates) {
                let statuses = new SchemaGroup(template, container_id).summary;
                for (let version of template.template_list) {
                    let version_number = version.name.split('-v')[1].split('-')[0].replaceAll('.', '');
                    let reader = new TemplateReader(version, version_number, url, statuses);
                    reader.retrieve();
                }
            }
        })
    }

}


class TemplateReader extends MangoRequest {
    constructor(template, version_number, url_new, statuses) {
        super(template.url);
        this.schema_name = `${template.schema_name}-${version_number}`;
        this.container_id = `v${version_number}-pane-${template.schema_name}`;
        this.url_new = url_new;
        this.parse_response(statuses);
    }

    parse_response(statuses) {
        this.addEventListener('load', () => {
            let json = Object.values(this.json)[0];
            let schema = new Schema(this.schema_name, this.container_id, this.url_new, json.version, statuses);
            schema.from_json(json);
            schema.view();
        })
    }
}