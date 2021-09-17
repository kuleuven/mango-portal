<template>
    
    <div class="formContainer d-flex flex-column">
        <div class="p-2">
            <button class="sideMenuButton btn btn-primary" @click="loadJSON()">Load JSON</button>
            <input type="file" style="display: none" ref="fileInput" accept="application/JSON" @change="onFilePicked"/>
        </div>
        <div class="p-2">
            <FormSchema id="metadata_form" :schema="schema" v-model="model" @submit.prevent="submit" :key="formKey" novalidate>
                    <button type="submit" class="btn btn-primary">Save</button>
            </FormSchema>
        </div>
        <ModalMessage v-if="showModal" @close="showModal = false">
            <h3 slot=message>Form is succesfully saved</h3>
        </ModalMessage>
    </div>

</template>

<script>
    import FormSchema from '@formschema/native';
    import schemaWithPointers from '../../../static/metadata-templates/metadata.json';
    import $RefParser from 'json-schema-ref-parser';
    import ModalMessage from './modals/ModalMessage.vue';
    import axios from 'axios';

    export default {
        props: {
            schema: {
                type: Object,
                default: () => {return {}}
            },
            fieldValues: {
                type: Object,
                default: () => {return {}}
            },
            submitUrl: {
                type: String,
                required: true
            }
        },
        data: () => ({
            model: {},
            showModal: false,
        }),
        computed: {
            formKey: function(){
                return JSON.stringify(this.model).split(",").length
            }
        },
        created () {
            this.model = this.fieldValues
            //TODO: remove next part and replace in backend using the prop schema
            //Removing $ref from schema
            $RefParser.dereference(schemaWithPointers)
            .then((schema) => {
                this.schema = schema;
            })
        },
        methods: {
            // Functions for loading a JSON schema
            onFilePicked(e){
                let files = e.target.files || e.dataTransfer.files;
                if (!files.length) return;
                this.readFile(files[0]);
            },
            loadJSON(){
                this.$refs.fileInput.click()
            },
            readFile(file) {
                let reader = new FileReader();
                reader.onload = e => {
                    let jsonWithReferences = JSON.parse(e.target.result);
                    $RefParser.dereference(jsonWithReferences).then((schema) => {
                        this.schema = schema;
                        this.model = {};
                    });
                };
                reader.readAsText(file);
            },
            // Returns the value of the model of  a given field from this.model
            getModelValueOfField(field){
                let modelValue = this.model;
                let str = field;
                let prevPos = 0;
                let pos = str.indexOf("[");
                if (pos === -1){
                    modelValue = modelValue[str];
                }
                while (pos !== -1 && typeof modelValue !== "undefined"){
                    let substring = str.substring(prevPos, pos);
                    modelValue = modelValue[substring];
                    prevPos = str.indexOf("[", pos)+1;
                    pos = str.indexOf("]", pos+1);
                }
                return modelValue
            },
            // makes all the inputs and select field in a given div invalid
            makeFieldsInvalid(div){
                var invalidInputs = div.getElementsByTagName("input");
                for (let i = 0; i < invalidInputs.length; i++){
                    invalidInputs[i].setCustomValidity("Invalid field.");
                }
                var invalidSelects = div.getElementsByTagName("select");
                for (let i = 0; i < invalidSelects.length; i++){
                    invalidSelects[i].setCustomValidity("Invalid field.");
                }
            },
            // makes all the inputs and select field in a given div valid
            makeFieldsValid(div){
                var invalidInputs = div.getElementsByTagName("input");
                for (let i = 0; i < invalidInputs.length; i++){
                    invalidInputs[i].setCustomValidity("");
                }
                var invalidSelects = div.getElementsByTagName("select");
                for (let i = 0; i < invalidSelects.length; i++){
                    invalidSelects[i].setCustomValidity("");
                }
            },
            // Makes the input field in thegiven div invalid and apply the given error message to the feedback div in the given div
            validateTextInput(div, errorMessage){
                var invalidFeedback = div.querySelector('.form-feedback');
                var input = div.getElementsByTagName("input")[0];
                if (!input.checkValidity()){
                    input.setCustomValidity("Invalid field.");
                    if (invalidFeedback == null){
                        invalidFeedback = document.createElement("div");
                        invalidFeedback.classList.add("form-feedback");
                        invalidFeedback.style = "display: block";
                        div.appendChild(invalidFeedback);
                    } else{
                        invalidFeedback.style = "display: block";
                    }
                    invalidFeedback.innerHTML = errorMessage;
                } else{
                    input.setCustomValidity("");
                    if (invalidFeedback != null){
                        invalidFeedback.style = "display: none";
                    }
                }
            },
            applyFeedback(div, errorMessage){
                var invalidFeedback = div.querySelector('.form-feedback');
                if (invalidFeedback == null){
                    invalidFeedback = document.createElement("div");
                    invalidFeedback.classList.add("form-feedback");
                    div.appendChild(invalidFeedback);
                }
                invalidFeedback.style = "display: block";
                invalidFeedback.innerHTML = errorMessage;
            },
            // Custom validation
            validate(){
                const form = document.getElementById("metadata_form");
                var formDivs = form.getElementsByTagName("div");
                let success = true;
                for (let i = 0; i < formDivs.length; i++) {
                    if (typeof formDivs[i].dataset !== "undefined" && typeof formDivs[i].dataset.fsField !== "undefined"){
                        let modelValue = this.getModelValueOfField(formDivs[i].dataset.fsField);
                        // If array is required, enforce that elements of the array are required
                        if (formDivs[i].dataset.fsRequired === "true" && formDivs[i].dataset.fsKind === "array"){
                            let arrayElements = formDivs[i].getElementsByTagName("div")[0].children;
                            for (let j = 0; j < arrayElements.length-1; j ++){
                                arrayElements[j].dataset.fsRequired = true;
                            }
                        }
                        // Check if required fields are empty and show error message if they are (only invalid if variable modelValue is undefined or an empty string and not a number)
                        if (formDivs[i].dataset.fsRequired === "true" && (typeof modelValue === "undefined" || modelValue === "")){
                            // Make all inputs in this div invalid by setting the custom validity
                            this.makeFieldsInvalid(formDivs[i]);
                            // Add or edit a div with an error message when a required field is empty
                            if (formDivs[i].dataset.fsKind !== "object" && formDivs[i].dataset.fsKind !== "array"){
                                this.applyFeedback(formDivs[i], "This field is required");
                            }
                            // If the required field is empty the form fails
                            success = false;
                        } 
                        //Check if checkboxes input fails, special implementation so custom validation necessary
                        else if (formDivs[i].dataset.fsRequired==="true" && formDivs[i].dataset.fsField.indexOf("checkboxes") !== -1 && formDivs[i].dataset.fsKind !== "boolean"){
                            // If none of the checkboxes are checked it fails
                            if (!Object.values(modelValue).includes(true)){
                                this.makeFieldsInvalid(formDivs[i]);
                                this.applyFeedback(formDivs[i], "This field is required");
                                success = false;
                            } else {
                                this.makeFieldsValid(formDivs[i]);
                                let invalidFeedback2 = formDivs[i].querySelector('.form-feedback');
                                if (invalidFeedback2 != null){
                                    invalidFeedback2.style = "display: none";
                                }
                            }
                        }
                        // Remove error message of required fields that are filled in
                        // Add extra checks on fields with patterns
                        else if ("fsKind" in formDivs[i].dataset && formDivs[i].dataset.fsKind !== "radio" && formDivs[i].dataset.fsKind !== "boolean" && formDivs[i].dataset.fsKind !== "array") {
                            // If a required field is not empty mark all the inputs ass valid by changing the setCustomValidity("") and remove the error message
                            this.makeFieldsValid(formDivs[i]);
                            let invalidFeedback3 = formDivs[i].querySelector('.form-feedback');
                            if (invalidFeedback3 != null){
                                invalidFeedback3.style = "display: none";
                            }
                            // For fields that must follow a certain pattern, the checks are done here
                            // Check if the input field is a valid email or url input and add the correct error message if the email or url is invalid
                            if (formDivs[i].dataset.fsType === "email" || formDivs[i].dataset.fsType === "url"){
                                this.validateTextInput(formDivs[i], "This is not a valid " + formDivs[i].dataset.fsType);
                            }
                            // Check if the input field is a valid number input and add the correct error message if the number is invalid
                            else if (formDivs[i].dataset.fsType === "number"){
                                let numberInput = formDivs[i].getElementsByTagName("input")[0];
                                let errorMessage = null;
                                if (numberInput.max != null && numberInput.min != null){
                                    errorMessage = "The number must be between " + numberInput.min + " and " + numberInput.max;
                                } else if (numberInput.max != null) {
                                    errorMessage = "The number must be lower than " + numberInput.max;
                                } else if (numberInput.min != null) {
                                    errorMessage = "The number must be higher than " + numberInput.min;
                                }
                                this.validateTextInput(formDivs[i], errorMessage);
                            }
                        }
                    }
                }
                // Add the class .was-validated to the form so the bootstrap validation is visible
                form.classList.add("was-validated");
                return success
            },
            // Function for submitting the filled in form
            submit() {
                // If validation succeeds submit the form
                if (this.validate()){
                    //Option 1
                    axios
                    .post(this.submitUrl, JSON.stringify(this.model));
                    //Option 2
                    const form = document.getElementById("metadata_form");
                    form.method = "post";
                    form.action = "/metadata-template/dump-form-contents"; // TODO: edit to correct address
                    form.submit();
                }
            },
        },
        components: {
            FormSchema,
            ModalMessage,
        },
    }
</script>
<style lang="scss">
    @import "../../css/forms.scss";
    @import "../../css/formEditor.scss";
    @import "../../css/modal.scss";
    @import "../../css/modalFormElement.scss";
</style>