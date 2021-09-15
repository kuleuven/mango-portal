<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <h3 style="display: inline">Add checkboxes input </h3>
                <div>
                    <form ref="addCheckboxesForm" class="needs-validation" novalidate>
                        <div>
                            <label for="checkboxesId" class="form-label h6">ID for checkboxes input</label>
                            <input class="form-control" id="checkboxesId" v-model="checkboxesId" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>
                        <div>
                            <label for="checkboxesLabel" class="form-label h6">Label for checkboxes input</label>
                            <input class="form-control" id="checkboxesLabel" v-model="checkboxesLabel" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>

                        <div style="display: block" v-for="(n, index) in numberOfCheckboxOptions" :key="index">
                            <label :for="'checkboxOption'+index" class="form-label h6">Checkbox option</label>
                            <div>
                                <input style="display: inline-block; width: calc(100% - 10.9em)" class="form-control" :id="'checkboxOption'+index" v-model="checkboxValues[index]" required>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveUp(index)" :disabled="index===0">↑</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveDown(index)" :disabled="index===numberOfCheckboxOptions-1">↓</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="deleteCheckboxOption(index)" :disabled="numberOfCheckboxOptions===1">-</button>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                        </div>
                        <button style="margin: 10px 0px 5px 0px;" type="button" class="btn btn-primary" @click="addCheckboxOption()">+</button>
                    </form>
                </div>
                <div>
                    <button style="margin: 5px 0px;" type="submit" class="btn btn-primary" @click="submitFinalObject()">Submit</button>
                </div>
                <div>
                    <button style="margin: 5px 0px;" class="cancel btn btn-primary" @click="$emit('cancel')">Cancel</button>
                </div>
            </div>
          </div>
        </div>
      </transition>
</template>

<script>
    export default {
        data: () => ({
            checkboxesId: "",
            checkboxesLabel: "",
            checkboxValues: [],
            numberOfCheckboxOptions: 1,
        }),
        methods: {
            // Returns the object of the check element to put in the final form
            finalObject() {
                var options = {};
                for (var i in this.checkboxValues){
                    options = Object.assign({}, options, {[this.checkboxValues[i]]:{"type": "boolean", "title": this.checkboxValues[i]}});
                }
                return {
                    [this.checkboxesId + "_checkboxes"]: {
                        "type": "object",
                        "title": this.checkboxesLabel,
                        "properties": options,
                    }
                }
            },
            // Submits the final object if it passes the form validation
            submitFinalObject(){
                let form = this.$refs.addCheckboxesForm;
                form.classList.add("was-validated");
                if (form.checkValidity()){
                    this.$emit('submit', this.finalObject());
                }
            },
            // Functions for adding checkbox options
            addCheckboxOption(){
                this.numberOfCheckboxOptions += 1;
            },
            // Functions for moving checkbox options
            moveUp(index){
                this.checkboxValues.splice(index-1, 0, this.checkboxValues[index]);
                this.checkboxValues.splice(index+1, 1);
            },
            moveDown(index){
                this.checkboxValues.splice(index+2, 0, this.checkboxValues[index]);
                this.checkboxValues.splice(index, 1);
            },
            // Function for deleting the option at checkboxOptions[index]
            deleteCheckboxOption(index){
                this.checkboxValues.splice(index,1);
                this.numberOfCheckboxOptions -= 1;
            },
        },
    }
</script>