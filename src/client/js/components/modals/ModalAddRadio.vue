<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <h3 style="display: inline">Add radio input </h3>
                <div>
                    <form class="needs-validation" novalidate>
                        <div>
                            <label for="radioId" class="form-label h6">ID for radio input</label>
                            <input class="form-control" id="radioId" v-model="radioId" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>
                        <div>
                            <label for="radioLabel" class="form-label h6">Label for radio input</label>
                            <input class="form-control" id="radioLabel" v-model="radioLabel" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>

                        <div style="display: block" v-for="(n,index) in numberOfRadioOptions" :key="index">
                            <label :for="'radioOption'+index" class="form-label h6">Radio option</label>
                            <div>
                                <input style="display: inline-block; width: calc(100% - 10.9em)" class="form-control" :id="'radioOption'+index" v-model="radioValues[index]" required>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveUp(index)" :disabled="index===0">↑</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="moveDown(index)" :disabled="index===numberOfRadioOptions-1">↓</button>
                                <button style="display: inline-block; margin-left: 1em; width: 2.3em" type="button" class="btn btn-primary" @click="deleteRadioOption(index)" :disabled="numberOfRadioOptions===1">-</button>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                        </div>
                        <button style="margin: 10px 0px 5px 0px;" type="button" class="btn btn-primary" @click="addRadioOption()" :disabled="numberOfRadioOptions === 4">+</button>
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
            radioId: "",
            radioLabel: "",
            radioValues: [],
            numberOfRadioOptions: 1,
            nextId: 1,
        }),
        methods: {
            // Returns the object of the radio element to put in the final form
            finalObject() {
                return {
                    [this.radioId]: {
                        "type": "string",
                        "enum": this.radioValues,
                        "title": this.radioLabel,
                    }
                }
            },
            // Submits the final object if it passes the form validation
            submitFinalObject(){
                let form = document.querySelectorAll('.needs-validation')[document.querySelectorAll('.needs-validation').length-1];
                form.classList.add("was-validated");
                if (form.checkValidity()){
                    this.$emit('submit', this.finalObject());
                }
            },
            // Functions for adding checkbox options
            addRadioOption(){
                this.numberOfRadioOptions += 1;
            },
            // Functions for moving checkbox options
            moveUp(index){
                this.radioValues.splice(index-1, 0, this.radioValues[index]);
                this.radioValues.splice(index+1, 1);
            },
            moveDown(index){
                this.radioValues.splice(index+2, 0, this.radioValues[index]);
                this.radioValues.splice(index, 1);
            },
            // Function for deleting the option at checkboxOptions[index]
            deleteRadioOption(index){
                this.radioValues.splice(index,1);
                this.numberOfRadioOptions-=1;
            },
        },
    }
</script>