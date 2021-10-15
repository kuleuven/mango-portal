<template>
    <transition name="modal">
        <div class="modal-mask">
            <div class="modal-wrapper">
                <div class="modal-container">
                    <div class="modal-message">
                        <div class="formEditorContainer d-flex flex-column">
                            <div class="p-2">
                                <button class="btn btn-primary" type="button" @click="loadJSON()">Load JSON from PC</button>
                                <input type="file" style="display: none" ref="fileInput" accept="application/JSON" @change="onFilePicked"/>
                                <button class="btn btn-primary" @click="saveTemplate()">Save template</button>
                                <button class="btn btn-primary" @click="$emit('cancel')">Cancel</button>
                            </div>

                            <div class="p-2">
                                <div class="row">
                                    <input ref="nameInput" class="form-control" type="text" placeholder="Metadata template name" v-model="templateName"/>
                                    <div v-if="templateName === ''" style="display:block;" class="invalid-feedback">Metadata template name is required</div>
                                </div>
                                <div class="row">
                                    <button class="btn btn-primary" @click="addBelow(null)">Add element</button>
                                </div>
                                <div v-for="(element, index) in elements" :key="index">
                                <!-- loops over elementIdList to get the right order of the form elements in elements list and displays them !-->
                                    <div class="row border rounded">
                                        <div class="row">
                                            <FormSchema ref="formSchema" :id="index.toString()" :schema="{'title': '',
                                                'type': 'object',
                                                'id':index,
                                                'properties': element}"></FormSchema>
                                        </div>
                                        <div class="row">
                                            <div class="column big">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="checkbox" @change="required.splice(index, 1, !required[index])" :checked="required[index]">
                                                    <label class="form-check-label">
                                                        Required
                                                    </label>
                                                </div>
                                            </div>
                                            <div class="column small">
                                                <button style="right:9em" class="btn btn-primary" @click="moveUp(index)" :disabled="index===0">↑</button>
                                                <button style="right:6em" class="btn btn-primary" @click="moveDown(index)" :disabled="index===elements.length-1">↓</button>
                                                <button class="btn btn-primary" @click="deleteElement(index)">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="row">
                                        <button class="btn btn-primary" @click="addBelow(index)">Add element</button>
                                    </div>
                                </div>
                            </div>

                            <ModalMessage v-if="showModalMessage" @close="showModalMessage=false">
                                <h3 slot=message>Error: ID was already used by an other form element. Try again with a different ID.</h3>
                            </ModalMessage>
                            <ModalFormElement v-else-if="showModalFormElement" @addArray="addArray()" @addCheckboxes="addCheckboxes()" @addRadio="addRadio()" @addSelect="addSelect()" @addText="addText()" @addObject="addObject()" @cancel="cancel()"></ModalFormElement>
                            <ModalAddText v-else-if="showModalAddText" @submit="submit" @cancel="cancel()"></ModalAddText>
                            <ModalAddSelect v-else-if="showModalAddSelect" @submit="submit" @cancel="cancel()"></ModalAddSelect>
                            <ModalAddRadio v-else-if="showModalAddRadio" @submit="submit" @cancel="cancel()"></ModalAddRadio>
                            <ModalAddCheckboxes v-else-if="showModalAddCheckboxes" @submit="submit" @cancel="cancel()"></ModalAddCheckboxes>
                            <ModalAddObject v-else-if="showModalAddObject" @submit="submit" @cancel="cancel()"></ModalAddObject>
                            <ModalAddArray v-else-if="showModalAddArray" @submit="submit" @cancel="cancel()"></ModalAddArray>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
    import FormSchema from '@formschema/native';
    import ModalMessage from './ModalMessage.vue';
    import ModalFormElement from './ModalFormElement.vue';
    import ModalAddText from './ModalAddText.vue';
    import ModalAddSelect from './ModalAddSelect.vue';
    import ModalAddRadio from './ModalAddRadio.vue';
    import ModalAddCheckboxes from './ModalAddCheckboxes.vue';
    import ModalAddObject from './ModalAddObject.vue';
    import ModalAddArray from './ModalAddArray.vue';
    import $RefParser from 'json-schema-ref-parser';
    import axios from 'axios';

    export default {
        props:{
            url: {
                type: String,
                required: true
            },
            template: {
                type: String,
                default: ""
            },
            name: {
                type: String,
                default: ""
            }
        },
        data: ()=>({
            templateName: "",
            elements: [],
            fieldIds: [],
            required: [],
            selectedElement: null,
            showModalMessage: false,
            showModalFormElement: false,
            showModalAddText: false,
            showModalAddSelect: false,
            showModalAddRadio: false,
            showModalAddCheckboxes: false,
            showModalAddObject: false,
            showModalAddArray: false,
        }),
        beforeMount(){
            if (this.template.length > 0)
                this.editTemplate(JSON.parse(this.template), this.name);
        },
        methods: {
            // Opens the given template to edit
            editTemplate(template, name){
                $RefParser.dereference(template).then((schema) => {
                    this.templateName = schema.title;
                    if(this.templateName === ""){
                        this.templateName = name;
                    }
                    this.elements = [];
                    this.required = [];
                    this.fieldIds = [];
                    for (const [key, value] of Object.entries(schema.properties)) {
                        this.elements.push({[key]:value});
                        this.fieldIds.push(key);
                        if (schema.required.includes(key)){
                            this.required.push(true);
                        } else {
                            this.required.push(false);
                        }
                    }
                })
            },
            // Functions for loading a JSON schema
            onFilePicked(e){
                let files = e.target.files || e.dataTransfer.files;
                if (!files.length) return;
                this.readFile(files[0]);
            },
            loadJSON(){
                this.$refs.fileInput.click();
            },
            readFile(file) {
                let reader = new FileReader();
                reader.onload = e => {
                    let length = file.name.length-5;
                    this.editTemplate(JSON.parse(e.target.result), file.name.substring(0,length));
                    this.$refs.fileInput.value = null;
                }
                reader.readAsText(file);
            },
            // Function for getting the result JSON of the form editor
            json() {
                var result = {};
                var required = [];
                for (var id in this.elements){
                    result = Object.assign({}, result, this.elements[id]);
                    if (this.required[id]){
                        required.push(Object.keys(this.elements[id])[0]);
                    }
                }
                return {"title": this.templateName,
                        "type": "object",
                        "required": required,
                        "properties":result}
            },
            // Function for downloading the final JSON from the form editor
            saveTemplate(){
                const nameElement = this.$refs.nameInput;
                if (this.templateName === ""){
                    nameElement.setCustomValidity("Invalid field.");
                } else {
                    nameElement.setCustomValidity("");
                    var formData = new FormData();
                    formData.append("template_name", this.templateName+".json");
                    formData.append("template_json",  JSON.stringify(this.json()));
                    axios.post(this.url, formData);
                    this.$emit("cancel");
                }
            },
            // Function for submitting and adding a new form element to the form editor
            submit(object){
                if (this.fieldIds.includes(Object.keys(object)[0])){
                    this.showModalMessage = true;
                } else{
                    if (this.selectedElement == null){
                        this.elements.splice(0, 0, object);
                        this.required.splice(0, 0, false);
                        this.fieldIds.splice(0, 0, Object.keys(object)[0]);
                    }else{
                        this.elements.splice(this.selectedElement+1, 0, object);
                        this.required.splice(this.selectedElement+1, 0, false);
                        this.fieldIds.splice(this.selectedElement+1, 0, Object.keys(object)[0]);
                    }
                    this.showModalAddText = false;
                    this.showModalAddSelect = false;
                    this.showModalAddRadio = false;
                    this.showModalAddCheckboxes = false;
                    this.showModalAddObject = false;
                    this.showModalAddArray = false;
                }
            },
            // Function for adding a new form element behind the element at elementIdList[index]
            addBelow(index){
                this.showModalFormElement = true;
                this.selectedElement = index;
            },
            // Functions for moving form elements
            moveUp(index){
                this.elements.splice(index-1, 0, this.elements[index]);
                this.elements.splice(index+1, 1);
                this.required.splice(index-1, 0, this.required[index]);
                this.required.splice(index+1, 1);
                this.fieldIds.splice(index-1, 0, this.fieldIds[index]);
                this.fieldIds.splice(index+1, 1);
            },
            moveDown(index){
                this.elements.splice(index+2, 0, this.elements[index]);
                this.elements.splice(index, 1);
                this.required.splice(index+2, 0, this.required[index]);
                this.required.splice(index, 1);
                this.fieldIds.splice(index+2, 0, this.fieldIds[index]);
                this.fieldIds.splice(index, 1);
            },
            // Function for deleting the element at elementIdList[index]
            deleteElement(index){
                this.elements.splice(index,1);
                this.required.splice(index,1);
                this.fieldIds.splice(index,1);
            },
            // Functions for adding a specific form element
            addArray(){
                this.showModalAddArray = true;
                this.showModalFormElement = false;
            },
            addCheckboxes(){
                this.showModalAddCheckboxes = true;
                this.showModalFormElement = false;
            },
            addObject(){
                this.showModalAddObject = true;
                this.showModalFormElement = false;
            },
            addRadio(){
                this.showModalAddRadio = true;
                this.showModalFormElement = false;
            },
            addSelect(){
                this.showModalAddSelect = true;
                this.showModalFormElement = false;
            },
            addText(){
                this.showModalAddText = true;
                this.showModalFormElement = false;
            },
            // Function for canceling adding a new form element
            cancel(){
                this.showModalFormElement = false;
                this.showModalAddText = false;
                this.showModalAddSelect = false;
                this.showModalAddRadio = false;
                this.showModalAddCheckboxes = false;
                this.showModalAddObject = false;
                this.showModalAddArray = false;
                this.selectedElement = null;
            },
        },
        components: {
            ModalMessage,
            ModalFormElement,
            ModalAddText,
            ModalAddSelect,
            ModalAddRadio,
            ModalAddCheckboxes,
            ModalAddObject,
            ModalAddArray,
            FormSchema,
        }
    }
</script>