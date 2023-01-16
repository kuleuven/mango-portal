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
            for (let template of templates) {
                let reader = new TemplateReader(template, container_id, url);
                reader.retrieve();
            }
        })
    }

}

class TemplateReader extends MangoRequest {
    constructor(template, container_id, url_new) {
        super(template.url);
        this.filename = template.name;
        this.container_id = container_id;
        this.url_new = url_new;
        this.parse_response();
    }

    parse_response() {
        this.addEventListener('load', () => {
            let schema = new Schema('basic', this.container_id, this.url_new);
            schema.from_json(Object.values(this.json)[0]);
            schema.view();
        })
    }
}