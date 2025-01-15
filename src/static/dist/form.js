/**
 * Class for a published version of a schema to be used when applying metadata.
 * @property {String} name Name of the schema.
 * @property {String} title User-facing label/title of the schema.
 * @property {String} container_id ID of the DIV to which the form will be attached.
 * @property {String} prefix Prefix of the metadata attribute names, e.g. `msg.book`.
 * @property {String} realm Name of the realm to which the schema belongs.
 * @property {String} version Version number of the current schema version.
 * @property {String} parent Name of the schema this schema was cloned from, if relevant. (Not implemented)
 * @property {Object<String,InputField>} fields Collection of fields that constitute this schema.
 * @property {HTMLFormElement} form Form used to implement the metadata annotation.
 */
class SchemaForm {
  /**
   * Create a form to apply metadata from a schema.
   * @param {SchemaInfo} json Contents of the JSON file on which the schema is stored.
   * @param {String} container_id ID of the DIV to which the form will be attached.
   * @param {String} prefix Prefix of the metadata attribute names, e.g. `msg.book`.
   */
  constructor(json, container_id, prefix) {
    // retrieve properties from the JSON contents
    this.name = prefix;
    this.title = json.title;
    this.realm = json.realm;
    this.version = json.version;
    // this.parent = json.parent;

    this.container = container_id;

    // create the form and add the fields
    this.from_json(json.properties);
    this.init_form();
  }

  from_json(schema_json) {
    function expand_composites(composite_field) {
      composite_field.minischema = new ObjectEditor(composite_field);
      composite_field.minischema.title = composite_field.json_source.title;
      Object.entries(composite_field.json_source.properties).forEach(
        (subfield) => {
          let new_field = InputField.choose_class(subfield);
          new_field.attach_schema(composite_field.minischema);
          composite_field.minischema.fields.push(new_field);
          if (new_field.form_type == "object") {
            expand_composites(new_field);
          }
        }
      );
    }

    // Go through each field in the JSON file and create its InputField
    this.fields = Object.entries(schema_json).map((entry) => {
      let new_field = InputField.choose_class(entry);
      if (new_field.form_type == "object") {
        expand_composites(new_field);
      }
      return new_field;
    });

    // Create names with the flattened ids, even inside objects
    SchemaForm.flatten_object(this);
    const flattened_names = {};
    function register_flattened_names(object) {
      object.fields.forEach((field) => {
        field.form_type == "object"
          ? register_flattened_names(field.minischema)
          : (flattened_names[field.name] = field);
      });
    }
    register_flattened_names(this);
    this.flattened_names = flattened_names;
  }

  /**
   * Create the form with all its fields.
   * @param {Object<String,FieldInfo>} schema_json Collection of Object-versions of fields.
   */
  init_form() {
    // Create the form, enabled for annotation
    let form_div = ComplexField.create_viewer(this, true);

    // Add a title to the form
    let title = document.createElement("h3");
    title.innerHTML = `<small class="text-muted">Metadata schema:</small> ${this.title} ${this.version}`;
    document.getElementById(this.container).appendChild(title);

    // Retrieve information from the URL and add it to the form as hidden fields
    const url = new URL(window.location.href);
    const url_params = url.searchParams;
    let version_name = `${this.name}.__version__`;
    for (let item of [
      "item_type",
      "object_path",
      "schema",
      "realm",
      version_name,
    ]) {
      let hidden_input = document.createElement("input");
      hidden_input.type = "hidden";
      hidden_input.name = item;
      hidden_input.value =
        item == version_name ? this.version : url_params.get(item);
      form_div.appendChild(hidden_input);
    }

    // Create a row for the submission button
    let submitting_row = Field.quick("div", "row border-top pt-2");
    let submitter = Field.quick("button", "btn btn-primary", "Save metadata");
    submitter.type = "submit";
    submitting_row.appendChild(submitter);
    form_div.appendChild(submitting_row);

    // Add attributes to the form so it submits directly
    form_div.setAttribute("action", post_url);
    form_div.setAttribute("method", "POST");
    form_div.setAttribute("novalidate", "");
    // Include BS5 validation
    form_div.addEventListener("submit", (e) => {
      if (!form_div.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form_div.classList.add("was-validated");
    });

    document.getElementById(this.container).appendChild(form_div);
    this.card = form_div;
    this.activate_autocompletes();
  }

  activate_autocompletes() {
    this.fields.forEach((field) => {
      if (field.type == "object") {
        field.minischema.activate_autocompletes(true);
      } else {
        field.activate_autocomplete();
        field.read_autocomplete();
      }
    });
  }

  /**
   * Fill in the form with existing metadata.
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   */
  add_annotation(annotated_data) {
    // add a hidden field with the value of 'redirect_route
    let hidden_input = document.createElement("input");
    hidden_input.type = "hidden";
    hidden_input.name = "redirect_route";
    hidden_input.value = annotated_data.redirect_route[0];
    this.card.appendChild(hidden_input);
    this.annotated_data = annotated_data;
    this.fields.forEach((field) => {
      if (field.name in this.annotated_data) {
        field.type == "object"
          ? this.register_object(field)
          : this.register_non_object(field);
      }
    });

    SchemaForm.prepare_objects(this, this.card, this.annotated_data);
  }

  /**
   * Register the annotated value of a specific (non composite) field.
   * @param {InputField} field Field to be annotated
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   * @param {HTMLFormElement|HTMLDivElement} form Form or div element inside which we can find the input field to fill in.
   */
  register_non_object(field, annotated_data = null, form = null) {
    // Start with the original form, but in fields inside a composite field it will be its div.
    form = form || this.card;
    annotated_data = annotated_data || this.annotated_data;
    const fid = field.name;

    // Extract the data linked to this field
    let existing_values = annotated_data[fid];
    let input_name =
      "__unit__" in annotated_data ? `${fid}__${annotated_data.__unit__}` : fid;

    // Identify checkboxes as cases where there are multiple input fields with the same name in the form
    // (this is only for multiple-value multiple-choice fields)

    let first_input = form.querySelector(`[data-field-name="${fid}"]`);

    function check_date(input, index) {
      let myDate = new Date(existing_values[index])
      if (myDate.getMilliseconds() != 0) {
        existing_values[index] = myDate.toISOString().slice(0, -1); //slice Z for timezone
      }   
      input.setAttribute("step", "any")
      //return (input, value)

    }

    // if we have multiple-value multiple-choice
    if (
      field.type == "select" &&
      (field.values.multiple || field.values.ui == "radio")
    ) {
      if (field.values.values.length <= MultipleInput.max_before_autocomplete) {
        // checkbox
        form.querySelectorAll(`[name="${input_name}"]`).forEach((chk) => {
          if (existing_values.indexOf(chk.value) > -1)
            chk.setAttribute("checked", "");
        });
      } else if (field.values.multiple) {
        // autocomplete
        const answers = first_input.querySelector("div[id$='answers']");
        for (let value of existing_values) {
          const [pill, label] = Field.autocomplete_checkbox(value, input_name);
          answers.appendChild(pill);
          answers.appendChild(label);
        }
      }
    } else if (existing_values.length == 1) {
      // if there is only one value for this field
        //fix datetime if necessary 
      let input =  form.querySelector(`[name="${input_name}"]`)
      if (field.type === "datetime-local") {
        check_date(input, 0)
      }
      input.value = existing_values[0];

    } else {
      // if the field has been duplicated
      // go through each of the values and repeat the input field with its corresponding value
      for (let i = 0; i < existing_values.length - 1; i++) {
        first_input.querySelector("label button").click();
      }
      form.querySelectorAll(`[name="${input_name}"]`).forEach((input, i) => {
        //check datetime and fix 
        if(field.type === "datetime-local")
          {
          check_date(input, i)
        }
        input.value = existing_values[i];
      });
    }
  }
  /**
   * Retrieve the annotated data corresponding to fields inside a given composite field.
   * @param {InputField} field Field to be annotated
   * @param {Object<String,String[]>} annotated_data Key-value pairs with the existing metadata.
   * @param {HTMLFormElement|HTMLDivElement} form Form or div element inside which we can find the input field to fill in.
   */
  register_object(field, annotated_data = null, form = null) {
    // Start with the original prefix, but accumulate when we have nested composite fields
    form = form || this.card;
    annotated_data = annotated_data || this.annotated_data;

    // Identify the fields that belong to this particular composite fields
    let existing_values = annotated_data[field.name];
    let minischema = field.minischema;
    if (!("__unit__" in existing_values[0])) {
      existing_values[0]["__unit__"] = ["1"];
    } // compatibility with pre-unit versions

    let first_unit = String(existing_values[0].__unit__[0]);

    // identify the piece of form in which annotation will be added
    let first_viewer = [...form.childNodes].filter(
      (child) =>
        child.classList.contains("mini-viewer") &&
        child.getAttribute("data-field-name") == field.name
    )[0];
    first_viewer.setAttribute("data-composite-unit", first_unit); // apply unit numbering
    // apply numbering to the input fields inside
    first_viewer.querySelectorAll("[name]").forEach((subfield) => {
      let current_name = subfield.name;
      // if the input field already has the parent unit in the name, replace it
      if (first_unit.split(".").length > 1) {
        let parent_unit = first_unit.match("^([.\\d]+?)\\.\\d+$")[1];
        let subfield_with_unit = current_name.match(`^(.+?)__${parent_unit}$`);
        if (subfield_with_unit != null) {
          current_name = subfield_with_unit[1];
        }
      }
      subfield.name = `${current_name}__${first_unit}`;
    });

    // repeat composite fiels as needed (simulating a button click)
    if (field.repeatable && existing_values.length > 1) {
      for (let i = 0; i < existing_values.length - 1; i++) {
        first_viewer.querySelector("h5 button").click();
      }
    }

    // apply annotation
    existing_values.forEach((object) => {
      let unit = object.__unit__[0];
      // select the correct viewer based on the unit
      let viewer = [...form.childNodes]
        .filter(
          (child) =>
            child.classList.contains("mini-viewer") &&
            child.getAttribute("data-field-name") == field.name &&
            child.getAttribute("data-composite-unit") == String(unit)
        )[0]
        .querySelector("div.input-view");

      // call the right registering method
      minischema.fields
        .filter((subfield) => subfield.name in object) // extract annotated subfields
        .forEach((subfield) => {
          subfield.type == "object"
            ? this.register_object(subfield, object, viewer)
            : this.register_non_object(subfield, object, viewer);
        });
    });
  }

  static prepare_objects(object_editor, form, annotated_data, unit = 1) {
    object_editor.fields
      .filter((field) => field.type == "object")
      .forEach((field) => {
        const fid = field.name;
        let viewer = form.querySelector(
          `div.mini-viewer[data-field-name="${fid}"]`
        );
        viewer.setAttribute("data-composite-unit", String(unit));
        let sub_schema = field.minischema;
        let empty_simple_subfields = sub_schema.fields.filter((subfield) => {
          let not_object = subfield.type != "object";
          let is_not_annotated = !(
            annotated_data != undefined && subfield.name in annotated_data
          );
          return not_object && is_not_annotated;
        });
        empty_simple_subfields.forEach((subfield) => {
          viewer
            .querySelectorAll(`[name="${subfield.name}"]`)
            .forEach((child) => (child.name = `${subfield.name}__${unit}`));
        });
        const sub_annotations =
          annotated_data != undefined ? annotated_data[fid] : undefined;
        SchemaForm.prepare_objects(
          sub_schema,
          viewer,
          sub_annotations,
          `${unit}.1`
        );
      });
  }

  static field_replicator(field, small_div, active) {
    let icon = Field.quick("i", "bi bi-front px-2");
    // for annotation, create a button
    let button = Field.quick("button", "btn btn-outline-dark p-0 mx-2");
    button.type = "button";

    // behavior when the 'repeat' button is clicked
    button.addEventListener("click", () => {
      // clone the div of the field, but instead of the 'repeat' button make a 'remove' button
      let clone = ComplexField.add_field_viewer(field, active);
      let clone_button = clone.querySelector("button i.bi-front").parentElement;
      let new_button = Field.quick("button", "btn btn-outline-dark p-0 mx-2");
      new_button.type = "button";
      let new_icon = Field.quick("i", "bi bi-trash px-2");
      new_button.appendChild(new_icon);
      new_button.addEventListener("click", () => {
        clone.remove();
      });
      clone_button.parentElement.replaceChild(new_button, clone_button);

      let existing_siblings = [...small_div.parentElement.childNodes].filter(
        (child) =>
          child.getAttribute("data-field-name") ==
          small_div.getAttribute("data-field-name")
      );

      let last_sibling = existing_siblings[existing_siblings.length - 1];
      if (last_sibling.nextSibling == undefined) {
        last_sibling.parentElement.appendChild(clone);
      } else {
        last_sibling.parentElement.insertBefore(
          clone,
          last_sibling.nextSibling
        );
      }

      if (field.type == "object") {
        let current_unit = small_div.getAttribute("data-composite-unit");
        let split_unit = current_unit.split(".");
        let existing_unit_suffixes = existing_siblings
          .map((child) =>
            parseInt(child.getAttribute("data-composite-unit").split(".").pop())
          )
          .sort();
        let largest_suffix = existing_unit_suffixes.pop();
        split_unit.pop();
        split_unit.push(String(largest_suffix + 1));
        let new_unit = split_unit.join(".");
        clone.setAttribute("data-composite-unit", new_unit);
        // add the cloned div after the last one of its kind

        function update_children_names(composite_field, subform, new_unit) {
          const direct_children = [
            ...subform.querySelector("div.input-view").childNodes,
          ];
          direct_children.forEach((child, i) => {
            const field_data = composite_field.minischema.fields[i];
            if (field_data.type != "object") {
              const inputs = child.querySelectorAll("input,select");
              inputs.forEach((input) => {
                input.name = `${field_data.name}__${new_unit}`;
                field_data.activate_autocomplete();
                field_data.read_autocomplete();
              });
            } else {
              const sub_unit = new_unit + ".1";
              child.setAttribute("data-composite-unit", sub_unit);
              update_children_names(field_data, child, sub_unit);
            }
          });
        }
        update_children_names(field, clone, new_unit);

        let inner_repeatables = [...clone.childNodes]
          .filter((subfield) => subfield.classList.contains("mini-viewer"))
          .filter((subfield) => subfield.querySelector("button i.bi-front"));
        // NOTE this is not good at dealing with nested composite fields yet!
        inner_repeatables.forEach((subfield) => {
          let subfield_data =
            field.minischema.fields[subfield.getAttribute("data-field-name")];
          let old_button =
            subfield.querySelector("button i.bi-front").parentElement;
          let new_button = SchemaForm.field_replicator(subfield_data, subfield);
          subfield.querySelector("label").replaceChild(new_button, old_button);
        });
      } else {
        let old_name = small_div.querySelector("[name]").name;
        clone.querySelector("[name]").name = old_name;
      }
    });
    button.appendChild(icon);
    return button;
  }

  /**
   * Recursive function that assigns a `name` property to each field with the flattened id.
   * @static
   * @param {SchemaForm|ObjectEditor} object_editor Schema or mini-schema for a composite field.
   */
  static flatten_object(object_editor) {
    object_editor.fields.forEach((field) => {
      // flatten the id
      let subfield_flattened = `${object_editor.name}.${field.name}`;
      // if the field is composite, apply this to each field inside
      if (field.constructor.name == "ObjectInput") {
        field.minischema.name = subfield_flattened;
        SchemaForm.flatten_object(field.minischema);
      }
      // assign the flattened id as a name
      field.name = subfield_flattened;
    });
  }
}
