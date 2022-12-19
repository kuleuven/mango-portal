<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <h3>Add text input</h3>
                <div class="addTextForm">
                    <form ref="addTextForm" class="needs-validation" novalidate>
                        <div>
                            <label for="textId" class="form-label h6">ID for text input</label>
                            <input class="form-control" id="textId" v-model="textId"
                            placeholder="Use lowercase, no spaces, no special characters other than '_'" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>
                        <div>
                            <label for="textLabel" class="form-label h6">Label for text input</label>
                            <input class="form-control" id="textLabel" v-model="textLabel"
                            placeholder="The text presented to the user as the name of this field, may include spaces and mixed case" required>
                            <div class="invalid-feedback">
                                This field is required
                            </div>
                        </div>
                        <div>
                            <label for="textType" class="form-label h6">Text type</label>
                            <select class="form-select" id="textType" v-model="textType" required>
                                <option value="Text" selected>Text</option>
                                <option value="LongText">Text box</option>
                                <option value="Number">Number</option>
                                <option value="Date">Date</option>
                                <option value="Email">Email</option>
                                <option value="Time">Time</option>
                                <option value="URL">URL</option>
                            </select>
                        </div>
                        <div v-if="textType==='Number'">
                            <label for="min" class="form-label h6">Minimum</label>
                            <input type="number" class="form-control" id="min" v-model="min">
                        </div>
                        <div v-if="textType==='Number'">
                            <label for="max" class="form-label h6">Maximum</label>
                            <input type="number" class="form-control" id="max" v-model="max">
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
        </div>
      </transition>
</template>

<script>
    export default {
        data: () => ({
            textId: "",
            textLabel: "",
            textType: "Text",
            min: null,
            max: null,
        }),
        methods: {
            // Returns the object of the text element to put in the final form
            finalObject() {
                switch (this.textType){
                    case "Text":
                        return {
                            [this.textId]: {
                                "type":"string",
                                "title":this.textLabel
                            }
                        };
                    case "LongText":
                        return {
                            [this.textId]: {
                                "type": "string",
                                "format": "textarea",
                                "title": this.textLabel
                            }
                        };

                    case "Number":
                        return {
                            [this.textId]: {
                                "type":"number",
                                "title":this.textLabel,
                                "minimum":this.min,
                                "maximum":this.max,
                            }
                        };
                    case "Date":
                        return {
                            [this.textId]: {
                                "type":"string",
                                "format": "date",
                                "title":this.textLabel
                            }
                        };
                    case "Email":
                        return {
                            [this.textId]: {
                                "type":"string",
                                "format": "email",
                                "title":this.textLabel
                            }
                        };
                    case "Time":
                        return {
                            [this.textId]: {
                                "type":"string",
                                "format": "time",
                                "title":this.textLabel
                            }
                        };
                    case "URL":
                        return {
                            [this.textId]: {
                                "type":"string",
                                "format": "uri",
                                "title":this.textLabel
                            }
                        };
                }
            },
            // Custom validation
            validate(){
                let success = true;
                // check if the minimum number of items is smaller than or equal to the maximum number of items
                var numberInputs = this.$refs.addTextForm.querySelectorAll("input[type=number]");
                if (this.min > this.max){
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
                return success;
            },
            // Submits the final object if it passes the form validation
            submitFinalObject(){
                let form = this.$refs.addTextForm;
                form.classList.add("was-validated");
                if (this.validate() && form.checkValidity()){
                    this.$emit('submit', this.finalObject());
                }
            },
        },
    }
</script>