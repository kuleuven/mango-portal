
console.log(schemasObject)


function removeLabels() {
    let rows = document.querySelectorAll("#schemaMetadata .row");
    let rowsArray = [...rows]
    if (rows.length > 1) {
        rowsArray.shift();
        rowsArray.forEach((row) => {
            row.querySelectorAll("label").forEach((label) => label.remove())
        })
    } 

}

removeLabels()

const selectSchemas = document.querySelectorAll("[name$='-schema']");

function updateAttributeChoice(schemaDropdown, schemasObject) {
    let attribute = schemaDropdown.closest(".row").querySelector("[name$='meta_a']");
    let selectedValue = attribute.value;

    attribute.innerHTML = "" // clear the attribute select field each time 
    const optgroups = {}
    for (const [key, value] of Object.entries(schemasObject[schemaDropdown.value])) {
        console.log(key)
        if (value.type === "label") {
            console.log(value.type)
            let optgroup = document.createElement("optgroup");
            optgroup.setAttribute("label", value.title);
            attribute.add(optgroup);
            optgroups[key] = optgroup;
        } else {
            let option = document.createElement("option");
            option.innerHTML = value.title;
            if (key == selectedValue) {
                option.setAttribute("selected", true)
            }
            option.value = key
            if (!value.parent) {
                attribute.add(option);
            }
            else {
                optgroups[value.parent].appendChild(option)
            };
        };
    };
    if (selectedValue) {
        let value = schemaDropdown.closest(".row").querySelector("[name$='meta_v']");
        let data = schemasObject[schemaDropdown.value][attribute.value];
        changeValueType(value, data);
    }

    attribute.addEventListener("change", () => {
        let value = schemaDropdown.closest(".row").querySelector("[name$='meta_v']");
        let data = schemasObject[schemaDropdown.value][attribute.value];
        changeValueType(value, data);
    })

};

selectSchemas.forEach((schemaDropdown) => {
    console.log(schemaDropdown);
    if (schemaDropdown.value) {
    updateAttributeChoice(schemaDropdown, schemasObject)
    }
    schemaDropdown.addEventListener('change', () => updateAttributeChoice(schemaDropdown, schemasObject))
});

function getAttributeValueElement(attribute) { // get attribute value element 
    if (attribute.id === "schema_metadata-meta_a") { // first one
        return (document.getElementById("schema_metadata-meta_v"))
    } else { // no label
        let i = 0;
        while (!attribute.id.includes(i)) {
            i++
        };
        return (document.getElementById("schema_metadata_no_label-" + i + "-meta_v"))
    }
}

function createField(type, elementName, elementID) { // function to create field based on type
    let element;
    if (type === "select") {
        element = document.createElement("select")
        element.classList.add("form-select");
    } else {
        element = document.createElement("input");
        element.type = type == "integer" ? "number" : type;
        element.classList.add("form-control");
    }
    element.id = elementID;
    element.setAttribute("name", elementName);
    element.dataset["target"] = "meta-value"
    return element
}

function changeValueType(value, data) {
    let currentName = value.name
    let currentId = value.id
    // function to check  the type for row with labels 
    let newField = createField(data.type, currentName, currentId);
    if (data.type == "select") {
        data.enum.forEach((optionText) => {
            let option = document.createElement("option");
            option.textContent = optionText;
            newField.appendChild(option)
        })
    }
    value.replaceWith(newField);
}



function updateId(indexString) {
    let splitString = indexString.split("-");
    let newIndex = String(parseInt(splitString[1]) + 1);
    splitString[1] = newIndex;
    return splitString.join("-");
}

function updateIndex(row) {

    row.querySelectorAll("[name],[id],[for]").forEach((item) => {
        if (item.hasAttribute("name")) {
            item.name = updateId(item.name);
            item.id = updateId(item.id);
        }
        else {
            item.setAttribute("for", updateId(item.getAttribute("for")));
        }
    })

}


button = document.getElementById("addSchemaField");
button.addEventListener("click", function () {
    addRow("schema", "schemaMetadata");

})



function addRow(type, elementId) {
    let container = document.getElementById(elementId);
    let lastRow = container.lastElementChild;
    let clonedRow = lastRow.cloneNode(true);
    if (type == "schema") {
        let clonedSchema = clonedRow.querySelector("[id$='-schema']");
        clonedSchema.addEventListener('change', () => updateAttributeChoice(clonedSchema, schemasObject));
        clonedSchema.selectedIndex = 0;
        clonedRow.querySelector("[id$='-meta_a']").innerHTML = ""
        clonedRow.querySelector("[id$='-meta_v']").innerHTML = ""
    }
    if (!clonedRow.querySelector("[id$=-remove]")) {
        createRemoveButton(clonedRow);
    }
    clonedRow.querySelector("[id$=-remove]").addEventListener("click", (event) => {removeRow(event)});
    updateIndex(clonedRow);
    container.appendChild(clonedRow);

    clonedRow.querySelectorAll("label").forEach((label) => label.remove());
}

function createRemoveButton(row) {
    let removeCol = document.createElement("div");
    removeCol.classList.add("col-md-1");
    let removeContainer = document.createElement("div");
    removeContainer.classList.add("mb-0");
    const removeButton = document.createElement("button");
    removeButton.classList.add("form-control");
    removeButton.id = "non_schema_metadata_no_label-0-remove";
    removeButton.setAttribute("name", "non_schema_metadata_no_label-0-remove");
    removeButton.type = "button";
    removeButton.innerHTML = '<i class="bi bi-trash"></i>';
    removeContainer.appendChild(removeButton);
    removeCol.appendChild(removeContainer);
    row.appendChild(removeCol)

}


function removeRow(event) {
    event.target.closest(".row").remove();
}

button = document.getElementById("addNonSchemaField");
button.addEventListener("click", function () {
    addRow("nonSchema", "nonSchemaMetadata");
})

