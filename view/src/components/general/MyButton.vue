<template>
    <button class="my-button" @click="emit('click')">
        <slot>Ok</slot>
    </button>
</template>

<script setup lang="ts">
const emit = defineEmits(['click']);
</script>


<style scoped lang="scss">
.my-button {
  padding: .5rem;
  background-color: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-border, transparent);
  color: var(--vscode-button-foreground);
  border-radius: 2px;
  outline: none;

  &:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  &:active {
        background-color: var(--vscode-button-secondaryBackground);
    }
}
</style>