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
        this.parse_response(container_id, urls);
    }

    parse_response(container_id, urls) {
        this.addEventListener('load', () => {
            let grouped_templates = this.json;
            console.log(grouped_templates)
            for (let template of grouped_templates) {
                let schema_name = template.name;
                let re = /(?<name>.*)-v(?<version>\d\.\d\.\d)-(?<status>|published|draft).json/
                let this_template = template.schema_info;
                let versions = []
                if (this_template.published_count > 0) {
                    versions.push(this_template.published_name.match(re).groups)
                }
                if (this_template.draft_count > 0) {
                    versions.push(this_template.draft_name.match(re).groups)
                }
                let title = this_template.title;
                new SchemaGroup(schema_name, title, versions, container_id,
                    {'get' : template.url, ...urls}) // this will create the schemas, which will load on demand
            }
        })
    }

}


class TemplateReader extends MangoRequest {
    constructor(url, schema) {
        super(url);
        this.parse_response(schema);
    }

    parse_response(schema) {
        this.addEventListener('load', () => {
            let json = this.json;
            schema.from_json(json);
            schema.view();
        })
    }
}

class AnnotationRequest extends MangoRequest {
    constructor(schema_url, annotated_data, prefix) {
        super(schema_url);
        this.parse_response(annotated_data, prefix);
    }

    parse_response(annotated_data, prefix) {
        this.addEventListener('load', () => {
            let json = this.json;
            let schema = new SchemaForm(json, container_id, prefix);
            console.log(annotated_data);
            schema.add_annotation(annotated_data);
        })
    }
}
