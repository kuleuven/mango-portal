<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <h3 style="display: inline">Add select input </h3>
                <div>
                    <form ref="addSelectForm" class="needs-validation" novalidate>
                        <div>
                            <label for="selectId" class="form-label h6">ID for select input</label>
                            <input class="form-control" id="selectId" v-model="selectId"
                            placeholder="Use lowercase, no spaces, no special characters other than '_'" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>
                        <div>
                            <label for="selectLabel" class="form-label h6">Label for select input</label>
                            <input class="form-control" id="selectLabel" v-model="selectLabel"
                            placeholder="The text presented to the user as the name of this field, may include spaces and mixed case" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>

                        <div style="display: block" v-for="(n,index) in numberOfSelectOptions" :key="index">
                            <label :for="'selectOption'+index" class="form-label h6">Select option</label>
                            <div>
                                <input style="display: inline-block; width: calc(100% - 10.9em)" class="form-control" :id="'selectOption'+index" v-model="selectValues[index]" required>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveUp(index)" :disabled="index===0">↑</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveDown(index)" :disabled="index===numberOfSelectOptions-1">↓</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="deleteSelectOption(index)" :disabled="numberOfSelectOptions<=5">-</button>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                        </div>
                        <button style="margin: 10px 0px 5px 0px;" type="button" class="btn btn-primary" @click="addSelectOption()">+</button>
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
            selectId: "",
            selectLabel: "",
            selectValues: [],
            numberOfSelectOptions: 5,
        }),
        methods: {
            // Returns the object of the select element to put in the final form
            finalObject() {
                return {
                    [this.selectId]: {
                        "type": "string",
                        "enum": this.selectValues,
                        "title": this.selectLabel,
                    }
                }
            },
            // Submits the final object if it passes the form validation
            submitFinalObject(){
                let form = this.$refs.addSelectForm;
                form.classList.add("was-validated");
                if (form.checkValidity()){
                    this.$emit('submit', this.finalObject());
                }
            },
            // Functions for adding checkbox options
            addSelectOption(){
                this.numberOfSelectOptions += 1;
            },
            // Functions for moving checkbox options
            moveUp(index){
                this.selectValues.splice(index-1, 0, this.selectValues[index]);
                this.selectValues.splice(index+1, 1);
            },
            moveDown(index){
                this.selectValues.splice(index+2, 0, this.selectValues[index]);
                this.selectValues.splice(index, 1);
            },
            // Function for deleting the option at checkboxOptions[index]
            deleteSelectOption(index){
                this.selectValues.splice(index,1);
                this.numberOfSelectOptions -= 1;
            },
        },
    }
</script>