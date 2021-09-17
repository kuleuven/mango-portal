<template>
    <div class="d-flex">
        <transition name="modal">
            <div class="modal-mask">
            <div class="modal-wrapper">
                <div class="modal-container">
                    <div class="modal-message">
                        <h3 style="margin: 0.5rem 1rem">Select the destination folder</h3>
                        <div class="d-flex" style="height:fit-content">
                            <treeselect style="margin: 0.5rem 1rem" v-model="destination" :always-open="true" :close-on-select="true" :clearable="true" :multiple="false" :searchable="true" :options="treeStructure"></treeselect>
                        </div>
                        <div v-if="destination==null" style="display:block; margin: 0.5rem 1rem" class="invalid-feedback">No destination selected</div>
                        <button type="button" style="margin: 0.5rem 1rem" class="btn btn-primary" @click="move()">Move</button>
                        <button type="button" style="margin: 0.5rem 0rem" class="btn btn-primary" @click="cancel()">Cancel</button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>
<script>
    import Treeselect from '@riophae/vue-treeselect';
    import '@riophae/vue-treeselect/dist/vue-treeselect.css';
    import axios from 'axios';

    export default {
        props:{
            browseRoot: {
                type: String,
                required: true
            }
        },
        data: () => ({
            destination: undefined,
            selectedCollections: [],
            selectedDataObjects: [],
            treeStructure: [],
        }),
        mounted() {
            axios
            .get(this.browseRoot) // TODO: edit to correct address
            .then(response => (this.treeStructure = response.data));
        },
        updated(){
            let rows = document.getElementById("browseTable").querySelectorAll("tr");
            let checkboxes = rows[0].querySelectorAll("[type=checkbox]");
            for (const checkbox of checkboxes){
                if (checkbox.checked){
                this.selectedDataObjects.push(checkbox.value);
                }
            }
            checkboxes = rows[1].querySelectorAll("[type=checkbox]");
            for (const checkbox of checkboxes){
                if (checkbox.checked){
                this.selectedCollections.push(checkbox.value);
                }
            }
            // Making the treeselect not floating and not overlapping with the buttons
            let menuContainer = document.querySelector(".vue-treeselect__menu-container");
            let menu = document.querySelector(".vue-treeselect__menu");
            menuContainer.style = "z-index:999; position:relative;top:auto;";
            menu.style = "max-height: 300px; position:relative;";
        },
        methods: {
            // Moves this.selectedCollections and this.selectedDataObjects to this.destination
            move(){
                if (this.destination != null){
                    //TODO: add api call
                    console.log("The selected collections ("+this.selectedCollections +") and selected data_objects ("+ this.selectedDataObjects+") are moved to "+this.destination+".");
                    let treeBrowser = document.getElementById("tree_browser");
                    tree_browser.style = "display: none!important";
                } 
            },
            cancel(){
                let treeBrowser = document.getElementById("tree_browser");
                tree_browser.style = "display: none!important";
            }
        },
        components:{
            Treeselect,
        }
}
</script>
<style lang="scss">
    @import "../../css/forms.scss";
    @import "../../css/formEditor.scss";
    @import "../../css/modal.scss";
    @import "../../css/modalFormElement.scss";
</style>