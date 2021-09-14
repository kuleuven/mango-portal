<template>
    <div>
        <h3 style="margin: 0.5rem 1rem">Select the destination folder</h3>
        <treeselect style="margin: 0.5rem 1rem" v-model="destination" :close-on-select="false" :clearable="true" :multiple="false" :searchable="true" :options="treeStructure"/>
        <div v-if="destination==null" style="display:block; margin: 0.5rem 1rem" class="invalid-feedback">No destination selected</div>
        <button type="button" style="margin: 0.5rem 1rem" @click="move()">Move</button>
        <button type="button" style="margin: 0.5rem 0rem">Cancel</button>
    </div>
</template>
<script>
    import Treeselect from '@riophae/vue-treeselect'
    import '@riophae/vue-treeselect/dist/vue-treeselect.css'
    import axios from 'axios'

    export default {
        props:{
            selectedFiles: {
                type: Array,
                default: () => []
            },
        },
        data: () => ({
            destination: undefined,
            treeStructure: [],
        }),
        mounted() {
            axios
            .get("http://localhost:5000/api/collection/tree/kuleuven_tier1_pilot/home") // TODO: edit to correct address
            .then(response => (this.treeStructure = response.data))
        },
        methods: {
            // Moves this.selectedFiles to this.destination
            move(){
                if (this.destination != null){
                    //TODO
                    console.log("The selected files ("+this.selectedFiles+") are moved to "+this.destination+".")
                } 
            },
        },
        components:{
            Treeselect,
        }
}
</script>