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
                if (!(template.schema_info.draft | template.schema_info.published)) {
                    continue;
                }
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
            if (grouped_templates.length > 0) {
                let existing_names = grouped_templates.map((x) => x.name).join('\\b|\\b');

                schema_pattern = `^((?!\\b${existing_names}\\b)${schema_pattern})+$`;
                console.log(schema_pattern)
                document.querySelectorAll('input[name="schema_name"]')
                    .forEach((input) => input.setAttribute('pattern', schema_pattern));    
            }
            
            const current_schema = urls['schema-name'];
            console.log(current_schema)
            console.log(schemas)
            if (current_schema && Object.keys(schemas).indexOf(current_schema) > -1) {
                new bootstrap.Collapse(`#${current_schema}-schemas`).show();
                let trigger = document.querySelector(`#nav-tab-${current_schema} button`);
                bootstrap.Tab.getOrCreateInstance(trigger).show();
                const current_version = urls['schema-version'];
                const version_data = grouped_templates.filter((x) => x.name == current_schema)[0].schema_info;
                if (current_version && version_data.versions_sorted.indexOf(current_version) > -1) {
                    let simple_version = current_version.replaceAll('.', '');
                    let version_trigger = document.querySelector(`button#v${simple_version}-tab-${current_schema}`);
                    bootstrap.Tab.getOrCreateInstance(version_trigger).show();
                }
            }
        });
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
