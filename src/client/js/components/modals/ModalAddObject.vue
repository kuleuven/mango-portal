<template>
    <transition name="modal">
        <div class="modal-mask">
            <div class="modal-wrapper">
                <div class="modal-container">
                    <h3 style="display: inline">Add object input </h3>
                    <div>
                        <div class="row">
                            <button class="btn btn-primary" @click="addBelow(null)">Add element</button>
                            <div v-if="elements.length===0" class="invalid-feedback" ref="noFormElementFeedback">
                                Please add at least one form element
                            </div>
                        </div>
                        <div v-for="(element, index) in elements" :key="index">
                            <div class="row border rounded">
                                <div class="row">
                                    <FormSchema :id="index.toString()" :schema="{'title': '',
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
                        <form class="needs-validation" novalidate>
                            <div>
                                <label for="objectId" class="form-label h6">ID for object input</label>
                                <input class="form-control" id="objectId" v-model="objectId" required>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
                            </div>
                            <div>
                                <label for="objectLabel" class="form-label h6">Label for object input</label>
                                <input class="form-control" id="objectLabel" v-model="objectLabel" required>
                                <div class="invalid-feedback">
                                    This field is required
                                </div>
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

            <ModalMessage v-if="showModalMessage" @close="showModalMessage=false">
                <h3 slot=message>Error: ID was already used by an other form element. Try again with a different ID.</h3>
            </ModalMessage>
            <ModalFormElement v-else-if="showModalFormElement" @addObject="addObject()" @addArray="addArray()" @addCheckboxes="addCheckboxes()" @addRadio="addRadio()" @addSelect="addSelect()" @addText="addText()" @cancel="cancel()"></ModalFormElement>
            <ModalAddText v-else-if="showModalAddText" @submit="submit" @cancel="cancel()"></ModalAddText>
            <ModalAddSelect v-else-if="showModalAddSelect" @submit="submit" @cancel="cancel()"></ModalAddSelect>
            <ModalAddRadio v-else-if="showModalAddRadio" @submit="submit" @cancel="cancel()"></ModalAddRadio>
            <ModalAddCheckboxes v-else-if="showModalAddCheckboxes" @submit="submit" @cancel="cancel()"></ModalAddCheckboxes>
            <ModalAddArray v-else-if="showModalAddArray" @submit="submit" @cancel="cancel()"></ModalAddArray>
            <modal-add-object v-else-if="showModalAddObject" @submit="submit" @cancel="cancel()"></modal-add-object>
        </div>
      </transition>
</template>

<script>
    import FormSchema from '@formschema/native'
    import ModalMessage from './ModalMessage.vue'
    import ModalFormElement from './ModalFormElement.vue'
    import ModalAddText from './ModalAddText.vue'
    import ModalAddSelect from './ModalAddSelect.vue'
    import ModalAddRadio from './ModalAddRadio.vue'
    import ModalAddCheckboxes from './ModalAddCheckboxes.vue'
    import ModalAddArray from './ModalAddArray.vue'

    export default {
        name: "modal-add-object",
        data: () => ({
            objectId: "",
            objectLabel: "",
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
            showModalAddArray: false,
            showModalAddObject: false,
        }),
        methods: {
            // Returns the object of the object element to put in the final form
            finalObject() {
                var result = {};
                var required = [];
                for (var id in this.elements){
                    result = Object.assign({}, result, this.elements[id]);
                    if (this.required[id]){
                        required.push(Object.keys(this.elements[id])[0]);
                    }
                }
                return {
                    [this.objectId]:{
                        "type": "object",
                        "title": this.objectLabel,
                        "required": required,
                        "properties": result,
                    }
                }
            },
            // Function for submitting and adding a new form element to the object editor
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
                    this.cancel();
                }
            },
            // Custom validation
            validate(){
                let success = true
                // Check if there is an element added to the array
                if (this.elements.length === 0){
                    this.$refs.noFormElementFeedback.style = "display: block; padding-left: 0" ;
                    success = false;
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
            addObject(){
                this.showModalAddObject = true;
                this.showModalFormElement = false;
            },
            // Function for canceling adding a new form element
            cancel(){
                this.showModalFormElement = false;
                this.showModalAddText = false;
                this.showModalAddSelect = false;
                this.showModalAddRadio = false;
                this.showModalAddCheckboxes = false;
                this.showModalAddArray = false;
                this.showModalAddObject = false;
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
            ModalAddArray,
            FormSchema,
        }
    }
</script>