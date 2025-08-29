const form = document.querySelector("form#add-yaml")
function validateYAML(contentsDiv, submitButton) {
    
    const yamlFormData = new FormData(form);
    const yamlValidationRequest = new Request(url, {
            method: "POST",
            body: yamlFormData
        });
    fetch(yamlValidationRequest)
        .then((response) => response.json())
        .then((json) => {
            const [path, yamlData] = json;
            const alertElement = contentsDiv.querySelector("div.alert");
            alertElement.innerHTML = path ? `Valid YAML! It will be stored as <code>${path}</code>` : "YAML is not valid";
            alertElement.className = path ? "alert alert-secondary" : "alert alert-danger";
            
            const preElement = contentsDiv.querySelector("pre");
            preElement.innerHTML = yamlData;
            if (path) {
                contentsDiv.querySelector("input").value = yamlData;
                submitButton.removeAttribute("disabled");
            } else {
                submitButton.setAttribute("disabled", "");
            }
    })
}
form.querySelector("input#user-management-file").addEventListener("change", (event) => {
    const reader = new FileReader();
    reader.readAsText(event.target.files[0]);
    reader.onload = () => {
        const contentsDiv = form.querySelector("div#user-management-yaml-contents");
        contentsDiv.querySelector("input").value = reader.result;
        validateYAML(contentsDiv, form.querySelector("button#add-user-management-yaml"));
    }
} )