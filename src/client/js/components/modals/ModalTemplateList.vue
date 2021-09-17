<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
              <div class="modal-message">
                    <h3>Choose a template to edit</h3>
                    <div class="input-group mb-3" v-for="template in templates" :key="template">
                        <button class="btn btn-primary" type="button" @click="getJsonToEdit(template.url, template.name)">Edit</button>
                        <span class="input-group-text">{{template.name}}</span>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-primary" type="button" @click="loadJSON()">Load JSON from PC</button>
                        <input type="file" style="display: none" ref="fileInput" accept="application/JSON" @change="onFilePicked"/>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-primary" type="button" @click="$emit('cancel')">Cancel</button>
                    </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
</template>

<script>
    import axios from 'axios';

    export default {
        props:{
            templateListUrl:{
                type: String,
                required: true
            }
        },
        data: () => ({
            templates: [],
        }),
        created(){
            axios
            .get(this.templateListUrl)
            .then(response => (this.templates = response.data));
        },
        methods:{
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
                    this.$emit('editTemplate', JSON.parse(e.target.result), file.name.substring(0,length));
                    this.$refs.fileInput.value = null;
                }
                reader.readAsText(file);
            },
            // Function to get the corresponding json to the given url for editing
            getJsonToEdit(url, name){
                let length = name.length-5;
                axios
                .get(url)
                .then(response => (this.$emit('editTemplate', response.data, name.substring(0,length))));
            }
        }
    }
</script>