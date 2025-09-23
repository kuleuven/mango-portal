
console.log(schemasObject)

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
    addRow();

})

function addRow() {
    let container = document.getElementById("schemaMetadata");
    let lastRow = container.lastElementChild;
    let clonedRow = lastRow.cloneNode(true);
    let clonedSchema = clonedRow.querySelector("[id$='-schema']");
    clonedSchema.addEventListener('change', () => updateAttributeChoice(clonedSchema, schemasObject));
    container.appendChild(clonedRow);
    updateIndex(clonedRow);
    clonedRow.querySelectorAll("label").forEach((label) => label.remove());
}




// // non-schema

// let counterNonSchema = document.getElementById("labelMetadata").childElementCount;

// buttonNonSchema = document.getElementById("addNonSchemaField");
// buttonNonSchema.addEventListener("click", function() {
//     let myList = document.querySelectorAll("#metadataFields #nonSchemaMetadata .row");
//     let row = document.createElement("div");
//     row.classList.add("row");
//     row.id = `nonSchemaRow-${counterNonSchema}`

//     //col 1 attribute name

//     console.log(counterNonSchema)
//     let attributeCol = document.createElement("div");
//     attributeCol.classList.add("col-md-4")
//     let attributeContainer = document.createElement("div")
//     attributeContainer.classList.add("mb-0")
//     const attributeInput = document.createElement("input")
//     attributeInput.classList.add("form-control");
//     attributeInput.setAttribute("name", `non_schema_metadata_no_label-${counterNonSchema}-meta_attribute`)
//     attributeInput.id = `non_schema_metadata_no_label-${counterNonSchema}-meta_attribute`;
//     attributeContainer.appendChild(attributeInput);
//     attributeCol.appendChild(attributeContainer);

//     //col 2 attribute value
//     let valueCol = document.createElement("div");
//     valueCol.classList.add("col-md-4")
//     let valueContainer = document.createElement("div")
//     valueContainer.classList.add("mb-0")
//     const valueInput = document.createElement("input")
//     valueInput.classList.add("form-control");
//     valueInput.setAttribute("name", `non_schema_metadata_no_label-${counterNonSchema}-meta_value`)
//     valueInput.id = `non_schema_metadata_no_label-${counterNonSchema}-meta_value`;
//     valueContainer.appendChild(valueInput);
//     valueCol.appendChild(valueContainer);

//     //col 3 Unit value
//     let unitCol = document.createElement("div");
//     unitCol.classList.add("col-md-3")
//     let unitContainer = document.createElement("div")
//     unitContainer.classList.add("mb-0")
//     const unitInput = document.createElement("input")
//     unitInput.classList.add("form-control");
//     unitInput.setAttribute("name", `non_schema_metadata_no_label-${counterNonSchema}-meta_unit`)
//     unitInput.id = `non_schema_metadata_no_label-${counterNonSchema}-meta_unit`;
//     unitContainer.appendChild(unitInput);
//     unitCol.appendChild(unitContainer);



//     //col 4 remove
//     let removeCol = document.createElement("div");
//     removeCol.classList.add("col-md-1")
//     let removeContainer = document.createElement("div")
//     removeContainer.classList.add("mb-0");
//     const removeButton = document.createElement("button")
//     removeButton.classList.add("form-control");
//     removeButton.id = `non_schema_metadata_no_label-${counterNonSchema}-remove`;
//     removeButton.setAttribute("name", `non_schema_metadata_no_label-${counterNonSchema}-remove`)
//     removeButton.type = "button";
//     removeButton.innerHTML = '<i class="bi bi-trash"></i>'
//     removeButton.addEventListener("click", (event) => {
//         removeRow(event.target)
//     });
//     removeButton.addEventListener("click", rowHandler);
//     // removeButton.value = "y";
//     removeContainer.appendChild(removeButton);
//     removeCol.appendChild(removeContainer);

//     row.appendChild(attributeCol)
//     row.appendChild(valueCol)
//     row.appendChild(unitCol)
//     row.appendChild(removeCol)

//     myList[myList.length - 1].after(row);
//     counterNonSchema++

// })