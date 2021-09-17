<template>
    <div class="formEditorContainer d-flex flex-column">
        <div class="p-2">
            <button class="btn btn-primary" @click="showTemplates()">Edit template</button>
            <button class="btn btn-primary" @click="showForm()">Show template preview</button>
            <button class="btn btn-primary" @click="saveTemplate()">Save template</button>
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
        <ModalFormPreview v-else-if="showModalFormPreview" :schema="json()" @exit="showModalFormPreview = false"></ModalFormPreview>
        <ModalAddText v-else-if="showModalAddText" @submit="submit" @cancel="cancel()"></ModalAddText>
        <ModalAddSelect v-else-if="showModalAddSelect" @submit="submit" @cancel="cancel()"></ModalAddSelect>
        <ModalAddRadio v-else-if="showModalAddRadio" @submit="submit" @cancel="cancel()"></ModalAddRadio>
        <ModalAddCheckboxes v-else-if="showModalAddCheckboxes" @submit="submit" @cancel="cancel()"></ModalAddCheckboxes>
        <ModalAddObject v-else-if="showModalAddObject" @submit="submit" @cancel="cancel()"></ModalAddObject>
        <ModalAddArray v-else-if="showModalAddArray" @submit="submit" @cancel="cancel()"></ModalAddArray>
        <ModalTemplateList v-else-if="showModalTemplateList" @editTemplate="editTemplate" @cancel="cancel()" :template-list-url="templateListUrl"></ModalTemplateList>
    </div>
    
</template>

<script>
    import FormSchema from '@formschema/native';
    import ModalMessage from './modals/ModalMessage.vue';
    import ModalFormElement from './modals/ModalFormElement.vue';
    import ModalFormPreview from './modals/ModalFormPreview.vue';
    import ModalAddText from './modals/ModalAddText.vue';
    import ModalAddSelect from './modals/ModalAddSelect.vue';
    import ModalAddRadio from './modals/ModalAddRadio.vue';
    import ModalAddCheckboxes from './modals/ModalAddCheckboxes.vue';
    import ModalAddObject from './modals/ModalAddObject.vue';
    import ModalAddArray from './modals/ModalAddArray.vue';
    import ModalTemplateList from './modals/ModalTemplateList.vue';
    import $RefParser from 'json-schema-ref-parser';
    import axios from 'axios';

    export default {
        props:{
            newUrl: {
                type: String,
                required: true
            },
            updateUrl: {
                type: String,
                required: true
            },
            templateListUrl: {
                type: String,
                required: true
            },
        },
        data: ()=>({
            templateName: "",
            templateType: "new",
            elements: [],
            fieldIds: [],
            required: [],
            selectedElement: null,
            showModalMessage: false,
            showModalFormElement: false,
            showModalFormPreview: false,
            showModalAddText: false,
            showModalAddSelect: false,
            showModalAddRadio: false,
            showModalAddCheckboxes: false,
            showModalAddObject: false,
            showModalAddArray: false,
            showModalTemplateList: false,
        }),
        methods: {
            // Opens a modal to show the existing templates to select 1 to edit
            showTemplates(){
                this.showModalTemplateList = true;
            },
            // Opens the given template to edit
            editTemplate(template, name){
                this.showModalTemplateList = false;
                this.templateType = "update";
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
                    if (this.templateType === "new") {
                        axios.post(this.newUrl, formData)
                    } else {
                        axios.post(this.updateUrl, formData)
                    }
                    // axios
                    // .post("/metadata-template/update", {"template_name": this.templateName, "template_json": this.json()});
                    // var element = document.createElement('a');
                    // element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.json())));
                    // element.setAttribute('download', this.templateName + ".json");
                    // element.style.display = 'none';
                    // document.body.appendChild(element);
                    // element.click();
                    // document.body.removeChild(element);
                }
            },
            // Function for showing a preview of the form
            showForm(){
                this.showModalFormPreview = true;
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
                this.showModalTemplateList = false;
            },
        },
        components: {
            ModalMessage,
            ModalFormElement,
            ModalFormPreview,
            ModalAddText,
            ModalAddSelect,
            ModalAddRadio,
            ModalAddCheckboxes,
            ModalAddObject,
            ModalAddArray,
            ModalTemplateList,
            FormSchema,
        }
    }
</script>
<style lang="scss">
    @import "../../css/forms.scss";
    @import "../../css/formEditor.scss";
    @import "../../css/modal.scss";
    @import "../../css/modalFormElement.scss";
</style>