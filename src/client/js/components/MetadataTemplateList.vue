<template>
    <div>
        <h3 class="mb-3">Zone metadata schemas</h3>
        <div class="input-group mb-3" v-for="template in templates" :key="JSON.stringify(template)">
            <span class="input-group-text">{{template.name}}</span>
            <button class="btn btn-primary" type="button" @click="editTemplate(template.url, template.name)">Edit</button>
            <button class="btn btn-primary" type="button" @click="viewTemplate(template.url, template.name)">View</button>
            <!-- <button class="btn btn-primary" type="button" @click="deleteTemplate(template.url, template.name)">Delete</button> -->
        </div>
        <div class="mb-3">
            <button class="btn btn-primary" type="button" @click="createTemplate()">Create new schema</button>
        </div>
        <ModalMetadataTemplateEditor v-if="showTemplateEditor" :url="apiUrl" :template="templateToEdit" :name="templateNameToEdit" @cancel="cancelEdit()"></ModalMetadataTemplateEditor>
        <ModalFormPreview v-else-if="showPreview" :schema="JSON.parse(templateToEdit)" @exit="showPreview=false"></ModalFormPreview>
    </div>
</template>

<script>
    import axios from 'axios';
    import ModalMetadataTemplateEditor from './modals/ModalMetadataTemplateEditor.vue';
    import ModalFormPreview from './modals/ModalFormPreview.vue';

    export default {
        props:{
            templateListUrl:{
                type: String,
                required: true
            },
            newUrl:{
                type: String,
                required: true
            },
            updateUrl:{
                type: String,
                required: true
            },
            newTemplateUrl:{
                type: String,
                required: true
            }
        },
        data: () => ({
            templates: [],
            templateToEdit: "",
            templateNameToEdit: "",
            apiUrl: "",
            showTemplateEditor: false,
            showPreview: false,
        }),
        beforeMount(){
            this.updateTemplateList();
        },
        methods:{
            updateTemplateList(){
                axios
                .get(this.templateListUrl)
                .then(response => (this.templates = response.data));
            },
            editTemplate(url,name){
                let length = name.length-5;
                axios
                .get(url)
                .then(response => {
                    this.templateToEdit = JSON.stringify(response.data);
                    this.templateNameToEdit = name.substring(0,length);
                    this.apiUrl = this.updateUrl;
                    this.showTemplateEditor = true;
                });
            },
            viewTemplate(url){
                axios
                .get(url)
                .then(response => {
                    this.templateToEdit = JSON.stringify(response.data);
                    this.showPreview = true;
                });
            },
            deleteTemplate(url, name){
                //TODO
            },
            createTemplate(){
                this.templateToEdit = "";
                this.templateNameToEdit = "";
                this.apiUrl = this.newUrl;
                this.showTemplateEditor = true;
            },
            cancelEdit(){
                this.showTemplateEditor = false;
                this.updateTemplateList();
            },
        },
        components:{
            ModalMetadataTemplateEditor,
            ModalFormPreview
        }
    }
</script>
<style lang="scss">
    @import "../../css/forms.scss";
    @import "../../css/formEditor.scss";
    @import "../../css/modal.scss";
    @import "../../css/modalFormElement.scss";
</style>