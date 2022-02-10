<template>
  <p>{{ greeting }} World!</p>
</template>

<script type="ts">
module.exports = {
  data: function() {
    return {
      greeting: "Hello paulsecret75"
    };
  }
};
</script>

<style scoped>
p {
  font-size: 2em;
  text-align: center;
}
</style>