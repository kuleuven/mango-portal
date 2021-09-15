<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
                <FormSchema :schema="schema"></FormSchema>
                <button class="btn btn-primary" @click="$emit('exit')"> Exit</button>
            </div>
          </div>
        </div>
      </transition>
</template>

<script>
    import FormSchema from '@formschema/native'

    export default {
        props: {
            schema: {
                type: Object,
                required: true
            }
        },
        components: {
            FormSchema,
        }
    }
</script>