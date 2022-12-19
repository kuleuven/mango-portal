<template>
    <transition name="modal">
        <div class="modal-mask">
            <div class="modal-wrapper">
                <div class="modal-container">
                    <h3 style="display: inline">Add Array input </h3>
                    <div>
                        <div v-if="elementChosen==null" class="row">
                            <button  class="btn btn-primary" @click="addElement()">Add element</button>
                            <div class="invalid-feedback" ref="noFormSelectedFeedback">
                                Please add a form element
                            </div>
                        </div>
                        <div v-else class="row border rounded">
                            <div class="column big">
                                <FormSchema ref="formSchema" :schema="{'title': '',
                                    'type': 'object',
                                    'properties': elementChosen}"></FormSchema>
                            </div>
                            <div class="column small">
                                <button class="btn btn-primary" @click="deleteElement()">Delete</button>
                            </div>
                        </div>
                        <form ref="addArrayForm" class="needs-validation" novalidate>
                            <div>
                                <label for="arrayId" class="form-label h6">ID for array input</label>
                                <input class="form-control" id="arrayId" v-model="arrayId"
                                placeholder="Use lowercase, no spaces, no special characters other than '_'" required>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                            <div>
                                <label for="arrayLabel" class="form-label h6">Label for array input</label>
                                <input class="form-control" id="arrayLabel" v-model="arrayLabel"
                                placeholder="The text presented to the user as the name of this field, may include spaces and mixed case" required>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                            <div>
                                <label for="minItems" class="form-label h6">Minimum number of array items</label>
                                <input type="number" class="form-control" id="minItems" v-model="minItems">
                            </div>
                            <div>
                                <label for="maxItems" class="form-label h6">Maximum number of array items</label>
                                <input type="number" class="form-control" id="maxItems" v-model="maxItems">
                            </div>
                            <div class="invalid-feedback" ref="minMaxFeedback">
                                The minimum can't be higher than the maximum.
                            </div>
                        </form>
                    </div>
                    <div>
                        <button style="margin: 10px 0px 5px 0px;" type="submit" class="btn btn-primary" @click="submitFinalObject()">Submit</button>
                    </div>
                    <div>
                        <button style="margin: 5px 0px;" class="cancel btn btn-primary" @click="$emit('cancel')">Cancel</button>
                    </div>
                </div>
            </div>
            <ModalFormElement v-if="showModalFormElement" :showArray="false" :showSelect="false" :showCheckboxes="false" :showRadio="false" @addText="addText()" @addObject="addObject()" @cancel="cancel()"></ModalFormElement>
            <ModalAddText v-else-if="showModalAddText" @submit="submit" @cancel="cancel()"></ModalAddText>
            <ModalAddObject v-else-if="showModalAddObject" @submit="submit" @cancel="cancel()"></ModalAddObject>
        </div>
      </transition>
</template>

<script>
    import FormSchema from '@formschema/native';
    import ModalFormElement from './ModalFormElement.vue';
    import ModalAddText from './ModalAddText.vue';

    export default {
        data: () => ({
            arrayId: "",
            arrayLabel: "",
            minItems: "",
            maxItems: "",
            elementChosen: null,
            showModalFormElement: false,
            showModalAddText: false,
            showModalAddObject: false,
        }),
        methods: {
            // Returns the object of the check element to put in the final form
            finalObject() {
                return {
                    [this.arrayId]:{
                        "type": "array",
                        "title": this.arrayLabel,
                        "minItems": this.minItems,
                        "maxItems": this.maxItems,
                        "items": Object.values(this.elementChosen)[0],
                    }
                }
            },
            // Custom validation
            validate(){
                let success = true;
                // Check if there is an element added to the array
                if (this.elementChosen == null){
                   this.$refs.noFormSelectedFeedback.style = "display: block; padding-left: 0";
                   success = false;
                }
                // check if the minimum number of items is smaller than or equal to the maximum number of items
                var numberInputs = this.$refs.addArrayForm.querySelectorAll("input[type=number]");
                if (this.minItems > this.maxItems){
                    this.$refs.minMaxFeedback.style = "display: block; padding-left: 0";
                    for (let j=0; j < numberInputs.length; j++){
                        numberInputs[j].setCustomValidity("Invalid field.");
                    }
                    success = false;
                } else {
                    this.$refs.minMaxFeedback.style = "display: none";
                    for (let j=0; j < numberInputs.length; j++){
                        numberInputs[j].setCustomValidity("");
                    }
                }
                return success
            },
            // Submits the final object if it passes the form validation
            submitFinalObject(){
                let form = document.querySelectorAll('.needs-validation')[document.querySelectorAll('.needs-validation').length-1];
                form.classList.add("was-validated");
                if (this.validate() && form.checkValidity()){
                    this.$emit('submit', this.finalObject());
                }
            },
            // Functions to add the form element to the array
            submit(object){
                this.elementChosen = object;
                this.showModalAddText = false;
                this.showModalAddObject = false;
            },
            // Function to open the modal to select a form element to add
            addElement(){
                this.showModalFormElement = true;
            },
            // Delete the chosen form element
            deleteElement(){
                this.elementChosen = null;
            },
            // Functions for adding the specific form elements
            addText(){
                this.showModalAddText = true;
                this.showModalFormElement = false;
            },
            addObject(){
                this.showModalAddObject = true;
                this.showModalFormElement = false;
            },
            // Function for cancelling the selection of a form element
            cancel(){
                this.showModalFormElement = false;
                this.showModalAddText = false;
                this.showModalAddObject = false;
            },
        },
        components: {
            FormSchema,
            ModalFormElement,
            ModalAddObject: () => import('./ModalAddObject.vue'), // import here because otherwise array can't import object because object needs to import array and gets in a loop
            ModalAddText,
        }
    }
</script>