<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <h3>What form element would you like to add?</h3>
                <!-- All types of form elements go here to select from !-->
                <div v-if="showText" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addText')">
                        Text input
                    </button>
                    <div class="HTMLElementExample">
                        Text options: regular text, number, date, email, time or url <br/>
                        <label class="form-label h6">
                            Title
                        </label>
                        <input class="form-control" placeholder="example placeholder">
                    </div>
                </div>
                <div v-if="showSelect" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addSelect')">
                        Select
                    </button>
                    <div class="HTMLElementExample">
                        <label class="form-label h6">
                            Title (Needs at least 5 options, otherwise use radio)
                        </label>
                        <select class="form-select" aria-label="Default select example">
                            <option selected>Open this select menu</option>
                            <option value="1">Option 1</option>
                            <option value="2">Option 2</option>
                            <option value="...">...</option>
                        </select>
                    </div>
                </div>
                <div v-if="showCheckboxes" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addCheckboxes')">
                        Checkboxes
                    </button>
                    <div class="HTMLElementExample">
                        <label class="form-label h6">
                            Title
                        </label>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="flexCheckDefault" checked>
                            <label class="form-check-label">
                                Option 1
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="flexCheckDefault">
                            <label class="form-check-label">
                               Option 2
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="flexCheckDefault">
                            <label class="form-check-label">
                               ...
                            </label>
                        </div>
                    </div>
                </div>
                <div v-if="showRadio" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addRadio')">
                        Radio
                    </button>
                    <div class="HTMLElementExample">
                        <label class="form-label h6">
                            Title (Can have at most 4 options, otherwise use select)
                        </label>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="flexRadioDefault" checked>
                            <label class="form-check-label">
                                Option 1
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="flexRadioDefault">
                            <label class="form-check-label">
                                Option 2
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="flexRadioDefault">
                            <label class="form-check-label">
                                ...
                            </label>
                        </div>
                    </div>
                </div>
                <div v-if="showObject" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addObject')">
                        Object
                    </button>
                    <div class="HTMLElementExample">
                        <div class="HTMLElement border rounded">
                            This can contain a combination of any of these form elements.
                        </div>
                    </div>
                </div>
                <div v-if="showArray" class="HTMLElement border rounded">
                    <button class="HTMLElementButton btn btn-primary" @click="$emit('addArray')">
                        Array
                    </button>
                    <div class="HTMLElementExample">
                        <FormSchema :schema="arraySchema"></FormSchema>
                    </div>
                </div>
                <button class="btn btn-primary" @click="$emit('cancel')">
                    Cancel
                </button>
            </div>
          </div>
        </div>
      </transition>
</template>

<script>
    import FormSchema from '@formschema/native';

    export default {
        props: {
            showText: {
                type: Boolean,
                default: true,
            },
            showSelect: {
                type: Boolean,
                default: true,
            },
            showCheckboxes: {
                type: Boolean,
                default: true,
            },
            showRadio: {
                type: Boolean,
                default: true,
            },
            showObject: {
                type: Boolean,
                default: true,
            },
            showArray: {
                type: Boolean,
                default: true,
            },
        },
        data: () => ({
            arraySchema: {
                "title": "Title",
                "type": "object",
                "properties": {
                    "ExampleArray": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "additionalProperties": false,
                            "yoda:structure": "subproperties",
                            "required": [],
                            "properties": {
                                "ExampleObject": {
                                    "type": "string",
                                    "title": "This could be any of the above form elements.",
                                },
                            }
                        }
                    },
                }
            }
        }),
        components: {
            FormSchema,
        }
    }
</script>