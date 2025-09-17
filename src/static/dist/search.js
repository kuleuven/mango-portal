
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


    // //code to add remove function on page reload
    // removeList = document.getElementById("labelMetadata").querySelectorAll(".remove");
    // removeList.forEach((element) => element.addEventListener("click", (event) => {
    //     removeRow(event.target)
    // }));
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
    // resetIndex();

}


// function resetIndex() { // -schema -meta_a -meta_v
//     //this function resets the index when a row is removed so that the indexes always go 0,1,2,...
//     console.log("resetting index...")

//     const container = document.getElementById("labelMetadata");

//     if (!container) {
//         console.warn("labelMetadata container not found.");
//         return;
//     }

//     const inputList = container.querySelectorAll(".row");
//     console.log("Found rows:", inputList.length);

//     // now we loop over the inputs and reset them all :)
//     console.log(inputList)
//     inputList.forEach(function(row, index) {
//         row.querySelector("[data-target='meta-schema']").name = `schema_metadata_no_label-${index}-schema`;
//         row.querySelector("[data-target='meta-schema']").id = `schema_metadata_no_label-${index}-schema`;
//         row.querySelector("[data-target='meta-attribute']").name = `schema_metadata_no_label-${index}-meta_a`;
//         row.querySelector("[data-target='meta-attribute']").id = `schema_metadata_no_label-${index}-meta_a`;
//         row.querySelector("[data-target='meta-value']").name = `schema_metadata_no_label-${index}-meta_v`
//         row.querySelector("[data-target='meta-value']").id = `schema_metadata_no_label-${index}-meta_v`;

//     });
//     console.log("...index resetted")
// }


function changeIds() {


}

// disable first button:
// document.getElementById("schema_metadata-remove").disabled = true;
// document.getElementById("non_schema_metadata-remove").disabled = true;

// remove first button
// document.getElementById("schema_metadata-remove").remove()
// document.getElementById("non_schema_metadata-remove").remove()



//code to add fields to form dynamically : schema & non-schema
// let counterSchema = document.getElementById("labelMetadata").childElementCount;
// console.log("non schema counter:", counterSchema)



button = document.getElementById("addSchemaField");
button.addEventListener("click", function () {
    addRow();
    
})



function addRow() {
    let container = document.getElementById("schemaMetadata")
    let lastRow = container.lastElementChild
    let clonedRow = lastRow.cloneNode(true)
    let clonedSchema = clonedRow.querySelector("[id$='-schema']")
    clonedSchema.addEventListener('change', () => updateAttributeChoice(clonedSchema, schemasObject))
    container.appendChild(clonedRow)
}

// //schema
// button = document.getElementById("addSchemaField");
// button.addEventListener("click", function() {
//     let row = document.createElement("div");
//     row.id = `schemaRow-${counterSchema}`
//     optionsList = document.getElementById("schema_metadata-schema");
//     row.classList.add("row");


//     //col1
//     let col1 = document.createElement("div")
//     col1.classList.add("col-md-4", "meta_schema")
//     let container1 = document.createElement("div")
//     container1.classList.add("mb-0")
//     const schemaSelectElement = document.createElement("select")
//     schemaSelectElement.classList.add("form-select");
//     schemaSelectElement.dataset['target'] = "meta-schema"
//     schemaSelectElement.setAttribute("name", `schema_metadata_no_label-${counterSchema}-schema`)
//     schemaSelectElement.id = `schema_metadata_no_label-${counterSchema}-schema`;

//     [...optionsList.children].forEach((x) => { // clone the schemas
//         const clone = x.cloneNode(true);
//         schemaSelectElement.appendChild(clone);
//     })
//     if ([...optionsList.children][0].innerHTML !== "choose a schema") {
//         prependPlaceholder(schemaSelectElement, "choose a schema");

//     }
//     schemaSelectElement.selectedIndex = 0;
//     container1.appendChild(schemaSelectElement);
//     col1.appendChild(container1);


//     //col2
//     let col2 = document.createElement("div")
//     col2.classList.add("col-md-3", "meta_attribute")
//     let container2 = document.createElement("div")
//     container2.classList.add("mb-0")
//     const attributeSelectElement = document.createElement("select")
//     attributeSelectElement.classList.add("form-select");
//     attributeSelectElement.dataset['target'] = "meta-attribute";
//     attributeSelectElement.setAttribute("name", `schema_metadata_no_label-${counterSchema}-meta_a`)
//     attributeSelectElement.id = `schema_metadata_no_label-${counterSchema}-meta_a`;
//     container2.appendChild(attributeSelectElement);
//     col2.appendChild(container2);

//     schemaSelectElement.addEventListener('change', function() {
//         let attribute = attributeSelectElement
//         attribute.innerHTML = "";
//         const optgroups = {} // create optgroups obj to store optgroups in
//         schemasObject[schemaSelectElement.value].forEach(dict => { // get the values for the select schema 
//             for (const [key, value] of Object.entries(dict)) {
//                 if (value.type === "label") { // if it is a label
//                     let optgroup = document.createElement("optgroup"); // create an optgroup
//                     optgroup.setAttribute("label", value.display_label);
//                     attribute.add(optgroup);
//                     optgroups[value.title] = optgroup; // add optgroup element to optgroup obj 
//                 } else { // if it is a field
//                     let option = document.createElement("option"); // create an option 
//                     option.innerHTML = value.title;
//                     option.setAttribute("value", key);
//                     console.log(value.enum)
//                     if (value.enum) {
//                         option.setAttribute("enum", value.enum)
//                     }
//                     option.setAttribute("type", value.type);

//                     if (!value.parent) {
//                         attribute.add(option); // add the option to attribute
//                     } else {
//                         optgroups[value.parent].appendChild(option) // if the parent is in the optgroup obj then we add the field to this group
//                     };
//                 };
//             };
//         });

//         let groups = attribute.querySelectorAll("optgroup"); // remove optgroup if it is empty
//         groups.forEach((x) => {
//             if (x.children.length === 0) {
//                 x.remove()
//             }
//         });
//         prependPlaceholder(attribute, "choose an attribute");
//     });



//     function createCheckTypeHandler(counterSchema) {
//         return function() {
//             return checkTypeNoLabel(counterSchema, attributeSelectElement);
//         };
//     }


//     let handler = createCheckTypeHandler(counterSchema); //use a closure to freeze function parameters
//     attributeSelectElement.addEventListener("change", handler);

//     //col3
//     let col3 = document.createElement("div")
//     col3.classList.add("col-md-4", "meta_value")
//     let container3 = document.createElement("div")
//     container3.classList.add("mb-0")
//     const valueInputField = document.createElement('input')
//     valueInputField.classList.add("form-control");
//     valueInputField.dataset['target'] = 'meta-value'
//     valueInputField.setAttribute("name", `schema_metadata_no_label-${counterSchema}-meta_v`)
//     valueInputField.id = `schema_metadata_no_label-${counterSchema}-meta_v`;
//     container3.appendChild(valueInputField);
//     col3.appendChild(container3);

//     // col 4 
//     let col4 = document.createElement("div")
//     col4.classList.add("col-md-1")
//     let container4 = document.createElement("div")
//     container4.classList.add("mb-0")
//     const removeButtonSchema = document.createElement("button")
//     removeButtonSchema.classList.add("form-control");
//     removeButtonSchema.setAttribute("name", `schema_metadata_no_label-${counterSchema}-remove`)
//     removeButtonSchema.id = `schema_metadata_no_label-${counterSchema}-remove`;
//     removeButtonSchema.type = "button";
//     removeButtonSchema.addEventListener("click", (event) => {
//         removeRow(event.target)
//     });
//     removeButtonSchema.innerHTML = '<i class="bi bi-trash"></i>'
//     //    removeButtonSchema.value = "y"
//     container4.appendChild(removeButtonSchema);
//     col4.appendChild(container4);

//     row.appendChild(col1)
//     row.appendChild(col2)
//     row.appendChild(col3)
//     row.appendChild(col4)

//     //   myList[myList.length - 1].after(row);
//     document.getElementById("labelMetadata").appendChild(row);

//     counterSchema++


// })


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