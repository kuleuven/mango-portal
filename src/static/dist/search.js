
function prependPlaceholder(schema, placeholder_text) {
    // create a placeholder for select fields
    let basicOption = document.createElement("option");
    basicOption.innerHTML = placeholder_text;
    basicOption.disabled = true;
    schema.prepend(basicOption);
    schema.selectedIndex = "0";
};

document.addEventListener("DOMContentLoaded", function () { // update the schema & attribute fields after search
    // fixed schema metadata (label)

    // document.getElementById("schema_metadata-meta_a").dispatchEvent(new Event("change", { // fake change event
    //     bubbles: true
    // }));
    // document.getElementById("schema_metadata-meta_v").value = resultsObject["schema_metadata-meta_v"];


    // // dynamic schema metadata (no label)
    // Object.entries(noLabelFields).forEach(([k, counterMd]) => {
    //     console.log(k, counterMd);
    //     // document.getElementById(`schema_metadata_no_label-${counterMd}-schema`).value = resultsObject[`schema_metadata_no_label-${counterMd}-schema`];
    //     // document.getElementById(`schema_metadata_no_label-${counterMd}-schema`).dispatchEvent(new Event("change", {
    //     //     bubbles: true
    //     // }));
    //     // document.getElementById(`schema_metadata_no_label-${counterMd}-meta_a`).value = resultsObject[`schema_metadata_no_label-${counterMd}-meta_a`];
    //     document.getElementById(`schema_metadata_no_label-${counterMd}-meta_a`).dispatchEvent(new Event("change", { // fake change event
    //         bubbles: true
    //     }));
    //     document.getElementById(`schema_metadata_no_label-${counterMd}-meta_v`).value = resultsObject[`schema_metadata_no_label-${counterMd}-meta_v`];
    // })


    //code to add remove function on page reload
    removeList = document.getElementById("labelMetadata").querySelectorAll(".remove");
    removeList.forEach((element) => element.addEventListener("click", (event) => {
        removeRow(event.target)
    }));
});


//  if (schema.value == "") { // if no schema is selected 
//         prependPlaceholder(schema, "choose a schema");
//     } 


// let groups = attribute.querySelectorAll("optgroup"); 
// groups.forEach((x) => {
//     if (x.children.length === 0) {
//         x.remove()
//     }
// });

console.log(schemasObject)

const selectSchemas = document.querySelectorAll("[name$='-schema']");
//const selectAttributes = document.querySelectorAll('[data-target="meta-attribute-label"], [data-target="meta-attribute"]');

function updateAttributeChoice(schemaDropdown, schemasObject) {
    let attribute = schemaDropdown.closest(".row").querySelector("[name$='meta_a']")
    attribute.innerHTML = "" // clear the attribute select field each time 
    const optgroups = {}
    for (const [key, value] of Object.entries(schemasObject[schemaDropdown.value])) {
        console.log(key)
        if (value.type === "label") {
            console.log(value.type)
            let optgroup = document.createElement("optgroup");
            optgroup.setAttribute("label", value.display_label);
            attribute.add(optgroup);
            optgroups[value.title] = optgroup;
        } else {
            let option = document.createElement("option");
            option.innerHTML = value.title;
            option.setAttribute("value", key);
            option.setAttribute("type", value.type);
            if (value.enum) {
                option.setAttribute("enum", value.enum)
            }
            if (!value.parent) {
                attribute.add(option);
            }
            else {
                optgroups[value.parent].appendChild(option)
            };
        };
    };
};

selectSchemas.forEach((schemaDropdown) => {
    console.log(schemaDropdown);
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
        element = document.createElement("input")
        element.classList.add("form-control");
    }
    element.id = elementID;
    element.setAttribute("name", elementName);
    element.dataset["target"] = "meta-value"

    return element
}


function checkTypeLabel(event) {
    // function to check  the type for row with labels 
    const attribute = event?.target;
    if (!attribute) return;
    console.log(attribute)
    let selectedOption = attribute.options[attribute.selectedIndex];

    if (!selectedOption) return; // safely exit if no option is selected

    let value = getAttributeValueElement(attribute);
    switch (selectedOption.getAttribute("type")) {
        case "select":
            let select = createField("select", "schema_metadata-meta_v", "schema_metadata-meta_v");
            let options = selectedOption.getAttribute("enum").split(",")
            options.forEach((optionText) => {
                let option = document.createElement("option");
                option.textContent = optionText;
                select.appendChild(option)
            })
            value.replaceWith(select);
            break;
        case "integer":
            let integer = createField("integer", "schema_metadata-meta_v", "schema_metadata-meta_v");
            value.replaceWith(integer);
            integer.type = "number";
            break;
        case "date":
            let date = createField("date", "schema_metadata-meta_v", "schema_metadata-meta_v");
            value.replaceWith(date);
            date.type = "date";
            break;
        default:
            let input = createField("default", "schema_metadata-meta_v", "schema_metadata-meta_v");
            value.replaceWith(input);
            input.type = "text";
    }
}


document.querySelectorAll("[id$='meta_a']").forEach((x) => x.addEventListener("change", checkTypeLabel));

//assign eventlistener
// let attribute = document.getElementById("schema_metadata-meta_a");
// attribute.addEventListener("change", checkTypeLabel);


// function checkTypeNoLabel(counter, attributeSelectElement) {
//     // function to check type with row with no labels
//     let selectedOption = attributeSelectElement.options[attributeSelectElement.selectedIndex];
//     let value = getAttributeValueElement(attributeSelectElement);
//     switch (selectedOption.getAttribute("type")) {
//         case "select":
//             let select = createField("select", `schema_metadata_no_label-${counter}-meta_v`, `schema_metadata_no_label-${counter}-meta_v`);
//             let options = selectedOption.getAttribute("enum").split(",")
//             options.forEach((optionText) => {
//                 let option = document.createElement("option");
//                 option.textContent = optionText;
//                 select.appendChild(option)
//             })
//             value.replaceWith(select);
//             break;
//         case "integer":
//             let integer = createField("integer", `schema_metadata_no_label-${counter}-meta_v`, `schema_metadata_no_label-${counter}-meta_v`);
//             value.replaceWith(integer);
//             integer.type = "number";
//             break;
//         case "date":
//             let date = createField("date", `schema_metadata_no_label-${counter}-meta_v`, `schema_metadata_no_label-${counter}-meta_v`);
//             value.replaceWith(date);
//             date.type = "date";
//             break;
//         default:
//             let input = createField("default", `schema_metadata_no_label-${counter}-meta_v`, `schema_metadata_no_label-${counter}-meta_v`);
//             value.replaceWith(input);
//             input.type = "text";
//     }
// }


// //  code to add type handler to attributes on page reload
// if (document.getElementById("schemaMetadata").childElementCount > 1) {
//     let noLabelCounter;
//     [...selectAttributes].forEach(function(schema, index) {
//             if (index === 0) { // skip the first one
//                 return;
//             }
//             if (index === 1) {
//                 noLabelCounter = 0;
//             } else {
//                 noLabelCounter += 1;
//             }
//             let attributeSelectElement = [...selectAttributes][index];

//             function createCheckTypeHandler2(noLabelCounter) {
//                 return function() {
//                     return checkTypeNoLabel(noLabelCounter, attributeSelectElement);
//                 };
//             }
//             let handler = createCheckTypeHandler2(noLabelCounter); //use a closure to freeze function parameters
//             attributeSelectElement.addEventListener("change", handler);
//     })
// }



function removeRow(button) {
    //function to remove a row
    const row = button.closest(".row")
    row.parentNode.removeChild(row);
    resetIndex();

}




function resetIndex() { 
    //this function resets the index when a row is removed so that the indexes always go 0,1,2,...
    const container = document.getElementById("schemaMetadata");
    const inputList = container.querySelectorAll(".row");
    inputList.forEach(function (row, index) {
        row.querySelector("[data-target='meta-schema-label']").name = `schema_metadata-${index}-schema`;
        row.querySelector("[data-target='meta-schema-label']").id = `schema_metadata-${index}-schema`;
        row.querySelector("[data-target='meta-attribute-label']").name = `schema_metadata-${index}-meta_a`;
        row.querySelector("[data-target='meta-attribute-label']").id = `schema_metadata-${index}-meta_a`;
        row.querySelector("[data-target='meta-value-label']").name = `schema_metadata-${index}-meta_v`
        row.querySelector("[data-target='meta-value-label']").id = `schema_metadata-${index}-meta_v`;

    });
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
    resetIndex();
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