class Designer {
  modal_id = "design-modal";
  message = "Design from scratch";
  name = "designer";
  constructor() {
    this.fields = [
      new TypedInput(),
      new SelectInput(),
      new CheckboxInput(),
      new ObjectInput(),
    ];
    this.create_navbar();
    this.create_modal();
  }

  create_modal() {
    // create the modal and add the div
    let design_modal = new Modal(
      this.modal_id,
      "What form element would you like to create?"
    );
    design_modal.create_modal([this.nav_content], "xl");
    this.card = this.nav_content;
  }

  create_navbar() {
    this.nav_content = Field.quick("div", "row");
    const sidebar = Field.quick("aside", "col-4");
    const mainbar = Field.quick("main", "col");
    const nav_bar = new NavBar("designer-nav", ["flex-column", "nav-pills"]);
    this.fields.forEach((field, i) => {
      nav_bar.add_item(field.id, field.button_title, i == 0);
      const tab = document.createElement("div");
      tab.appendChild(field.render());
      // create the button that triggers the modal
      let new_button = Field.quick(
        "button",
        "btn btn-primary choice-button",
        `Create a ${field.button_title.toLowerCase()}`
      );
      field.setup_rendering_button(new_button);
      tab.appendChild(new_button);

      nav_bar.add_tab_content(field.id, tab);
    });
    sidebar.appendChild(nav_bar.nav_bar);
    mainbar.appendChild(nav_bar.tab_content);
    this.nav_content.appendChild(sidebar);
    this.nav_content.appendChild(mainbar);
  }

  attach_schema(schema) {
    this.fields.forEach((field) => {
      field.attach_schema(schema);
      field.update_id_regex(schema.field_id_regex);
    });
  }
}

class Library {
  modal_id = "library-modal";
  message = "Browse library";
  name = "library";

  constructor(library_fields) {
    this.library_fields = library_fields;
    this.fields = this.library_fields.map((field) => {
      let field_object;
      if (field.data.type == "object") {
        field_object = new ObjectInput();
      } else if (field.data.type == "select") {
        field_object = field.data.multiple
          ? new CheckboxInput()
          : new SelectInput();
      } else {
        field_object = new TypedInput();
      }
      field_object.name = field.name;
      field_object.from_json(field.data);
      if (field.data.type == "object") {
        field_object.init_minischema();
      }
      return field_object;
    });
    this.buttons = [];
    this.create_navbar();
    this.create_modal();
  }

  create_modal() {
    this.modal = new Modal(this.modal_id, "Choose a pre-made form element.");
    this.modal.create_modal([this.nav_content], "lg");
    this.card = this.nav_content;
    this.fields.forEach((field) => {
      if (field.type == "object") {
        field.minischema.activate_autocompletes();
      } else {
        field.activate_autocomplete();
      }
    });
  }

  create_navbar() {
    this.nav_content = Field.quick("div", "row");
    const sidebar = Field.quick("aside", "col-3");
    const mainbar = Field.quick("main", "col");
    const nav_bar = new NavBar("library-nav", ["flex-column", "nav-pills"]);
    this.fields.forEach((field, i) => {
      nav_bar.add_item(field.name, field.title, i == 0);
      const tab = document.createElement("div");
      const description = Field.quick(
        "p",
        "fw-light",
        `From ${this.library_fields[i].source}.`
      );
      const button = this.create_button(i);
      tab.appendChild(description);
      tab.appendChild(ComplexField.add_field_viewer(field));
      tab.appendChild(button);
      this.buttons.push({ button: button, i: i });
      nav_bar.add_tab_content(field.name, tab);
    });
    sidebar.appendChild(nav_bar.nav_bar);
    mainbar.appendChild(nav_bar.tab_content);
    this.nav_content.appendChild(sidebar);
    this.nav_content.appendChild(mainbar);
  }

  create_button(i) {
    const field = this.fields[i];
    const button = Field.quick(
      "button",
      "btn btn-primary mt-1",
      `Add "${field.title}"`
    );
    button.id = field.get_domel_id("library");
    return button;
  }

  attach_schema(schema) {
    this.buttons = this.buttons.map((button_group) => {
      const { button, i } = button_group;
      const field_json = this.library_fields[i];
      const new_button = this.create_button(i);
      const name_exists = schema.field_ids.indexOf(field_json.name) > -1;
      const parent = button.parentElement;
      new_button.addEventListener("click", () => {
        schema.add_fields_from_json(
          Object.fromEntries([
            [
              name_exists ? `${field_json.name}-new` : field_json.name,
              field_json.data,
            ],
          ]),
          this.modal_id
        );
      });
      parent.replaceChild(new_button, button);

      const old_message = parent.querySelector(`#${field_json.name}-exists`);
      if (name_exists && old_message == null) {
        const msg_box = Field.quick(
          "div",
          "border border-danger text-danger text-wrap shadow rounded-1 p-2 mt-2",
          `The '${schema.name}' schema already has a field with this name: this field will be added as '${field_json.name}-new'.`
        );
        msg_box.id = `${field_json.name}-exists`;
        parent.appendChild(msg_box);
      } else if (old_message != null) {
        old_message.remove();
      }
      return { button: new_button, i: i };
    });
  }
}

class JsonInput {
  constructor() {
    this.create_contents();
    this.create_modal();
  }
  modal_id = "json-upload-modal";
  message = "Upload JSON";
  name = "file";

  create_modal() {
    this.modal = new Modal(
      this.modal_id,
      "Upload a JSON file with one or more form elements."
    );
    this.modal.create_modal([this.json_div], "lg");
    this.modal_modal = document.getElementById(this.modal_id);
    this.modal_modal.addEventListener("hidden.bs.modal", () => {
      this.reset();
    });
  }

  create_button() {
    const button = Field.quick(
      "button",
      "btn btn-primary",
      "<strong>Load from JSON</strong>"
    );
    button.setAttribute("disabled", "");
    return button;
  }

  attach_schema(schema) {
    const new_button = this.create_button();
    this.json_div.replaceChild(new_button, this.button);
    this.button = new_button;
    // it is possible to load something
    this.button.addEventListener("click", () => {
      if (this.fields) {
        schema.add_fields_from_json(this.fields, this.modal_id);
      }
    });
    this.existing_names = schema.field_ids;
  }

  verify_json_data(data) {
    this.fields = {};
    const summary_color = [...this.json_summary.classList].filter((x) =>
      x.startsWith("text-bg-")
    )[0];
    try {
      // see if the JSON can be parsed at all
      let new_fields = JSON.parse(data);
      if (new_fields.constructor.name == "Object") {
        // if it's a JSON and has the correct type
        if (
          !Object.values(new_fields).every(
            (f) => f.constructor.name == "Object"
          ) && // not all eelemnts are objects
          "properties" in new_fields // it has a properties attribute
        ) {
          new_fields = new_fields.properties;
        }

        let errors = [],
          warnings = [];
        let errors_field = "",
          warnings_field = "";
        let original_fields = Object.keys(new_fields).length;

        // go through each field in the object and validate it
        for (let field of Object.entries(new_fields)) {
          const { messages: new_msg, ok: new_ok } = InputField.validate_class(
            field[1]
          );
          if (!new_ok) {
            // if the field is not valid at all
            delete new_fields[field[0]];
            errors.push(
              `<p class="text-danger fw-bold m-0">The field '${field[0]}' was deleted because it was not in order.</p>`
            );
            errors = [...errors, ...new_msg];
          } else {
            let field_name = field[0];
            while (this.existing_names.indexOf(field_name) > -1) {
              field_name = field_name + "-new";
            }
            // if the name already exists (and was therefore changed)
            if (field[0] != field_name) {
              new_fields[field_name] = { ...field[1] };
              delete new_fields[field[0]];
              warnings.push(
                `<p class="text-warning fw-bold m-0">The field '${field[0]}' was renamed to '${field_name}' because '${field[0]}' already exists, and moved to the end.</p>`
              );
            }
            if (new_msg.length > 0) {
              warnings.push(
                `<p class="text-warning fw-bold m-0">The field '${field_name}' was modified.</p>`
              );
              warnings = [...warnings, ...new_msg];
            }
          }
        }

        // write up a box with error messages if there are any (=fields that were discarded)
        if (errors.length > 0) {
          let errors_list = errors
            .map((x) => (x.startsWith("<") ? x : `<p class="m-0">${x}</p>`))
            .join("");
          errors_field = `<div class="border border-danger px-2 mb-2"><h4 class="text-danger">Errors</h4>${errors_list}</div>`;
        }

        // write up a box with warnings if there are any (=fields that were only modified)
        if (warnings.length > 0) {
          let warnings_list = warnings
            .map((x) => (x.startsWith("<") ? x : `<p class="m-0">${x}</p>`))
            .join("");
          warnings_field = `<div class="border border-warning px-2 mb-2"><h4 class="text-warning">Warnings</h4>${warnings_list}</div>`;
        }
        let final_fields = Object.keys(new_fields).length;

        // prepare the new contents for the <pre> box
        let text_fields = {
          errors: errors_field,
          warnings: warnings_field,
          text: JSON.stringify(new_fields, null, "  "),
        };

        if (final_fields == 0) {
          // if all fields were invalid
          this.json_summary.classList.replace(summary_color, "text-bg-danger");
          this.json_summary.innerHTML =
            "<strong>ERROR</strong>: The contents of this file are not correct!";
          text_fields.text = JSON.stringify(JSON.parse(data), null, "  ");
        } else {
          this.button.removeAttribute("disabled", "");
          this.fields = new_fields;
          if (final_fields < original_fields) {
            // some fields were invalid
            this.json_summary.classList.replace(
              summary_color,
              "text-bg-warning"
            );
            this.json_summary.innerHTML =
              "<strong>WARNING</strong>: Some fields were removed because they were not appropriate, but the rest can be uploaded.";
          } else {
            this.json_summary.classList.replace(
              summary_color,
              "text-bg-success"
            );
            this.json_summary.innerHTML =
              "<strong>SUCCESS!</strong> This file is correct and the fields can be read!";
          }
        }
        this.json_example.innerHTML = Object.values(text_fields).join("");
      } else {
        // the JSON was valid but not an object
        this.json_summary.classList.replace(summary_color, "text-bg-danger");
        this.json_summary.innerHTML =
          "<strong>ERROR</strong>: The uploaded JSON is not an object.";
        this.json_example.innerHTML = JSON.stringify(new_fields, null, "  ");
      }
    } catch (e) {
      // there was some error
      this.json_summary.classList.replace(summary_color, "text-bg-danger");
      if (e instanceof SyntaxError) {
        // the problem is invalid JSON
        this.json_summary.innerHTML =
          "<strong>ERROR</strong>: The uploaded file is not valid JSON.";
        this.json_example.innerHTML = data;
      } else {
        // there was something else
        this.json_summary.innerHTML = "<strong>UNEXPECTED ERROR</strong>";
        this.json_example.innerHTML = e;
      }
    }
  }

  create_contents() {
    let input_id = "choose-json";
    const reader = new FileReader();
    reader.onload = () => {
      this.verify_json_data(reader.result);
    };

    this.json_div = Field.quick("div", "ex my-2");
    const explanation = Field.quick(
      "p",
      "fst-italic",
      "Extract fields form a JSON file with fields or with a full schema (only the fields will be uploaded!)."
    );
    this.button = this.create_button();
    const label = Field.quick(
      "label",
      "form-label",
      "Choose a file or drag and drop into the field below."
    );
    label.setAttribute("for", input_id);

    const input = Field.quick("input", "form-control");
    input.id = input_id;
    input.type = "file";
    input.setAttribute("accept", ".json");
    input.addEventListener("change", (e) => {
      reader.readAsText(e.target.files[0]);
    });

    this.json_summary = Field.quick(
      "p",
      "text-bg-secondary p-2 mt-2 rounded",
      "No file has been uploaded yet."
    );
    this.json_summary.id = "load-summary";

    this.json_div.appendChild(explanation);
    this.json_div.appendChild(label);
    this.json_div.appendChild(input);
    this.json_div.appendChild(this.json_summary);
    this.add_example(reader);
    this.json_div.appendChild(document.createElement("br"));
    this.json_div.appendChild(this.button);
  }

  add_example(reader) {
    // Example with drag-and-drop
    this.json_example = Field.quick("pre", "border p-1 bg-light");
    const example = {
      field_id: {
        title: "Informative label",
        type: "select",
        ui: "radio",
        values: ["one", "two", "three"],
        multiple: false,
      },
    };
    this.json_example.setAttribute(
      "style",
      "width:700px; white-space: pre-wrap;margin-top:1em;"
    );
    this.json_example.innerHTML = JSON.stringify(example, null, "  ");
    this.json_example.addEventListener("dragover", (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    this.json_example.addEventListener("drop", (e) => {
      e.stopPropagation();
      e.preventDefault();
      reader.readAsText(e.dataTransfer.files[0]);
    });
    this.json_div.appendChild(this.json_example);
  }

  reset() {
    const old_div = this.json_div;
    this.create_contents();
    this.modal_modal
      .querySelector(".modal-body")
      .replaceChild(this.json_div, old_div);
  }
}
