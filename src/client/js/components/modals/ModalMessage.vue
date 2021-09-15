<template>
    <transition name="modal">
        <div class="modal-mask">
          <div class="modal-wrapper">
            <div class="modal-container">
              <div class="modal-message">
                    <slot name="message">
                        default header
                    </slot>
                    <button class="modal-default-button btn btn-primary" @click="$emit('close')">
                        OK
                    </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
</template>

<script>
    export default {}
</script>