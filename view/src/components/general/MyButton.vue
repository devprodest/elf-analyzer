<template>
  <button class="my-button" :class="{ 'is-active': active }" @click="emit('click')">
    <slot>Ok</slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  active?: boolean;
}>();

const emit = defineEmits(['click']);
</script>

<style lang="scss">
.my-button {
  padding: 0 0.8rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  /* Отступ между иконкой и текстом, если есть */
  background-color: var(--vscode-button-secondaryBackground, transparent);
  border: 1px solid var(--vscode-button-border, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
  border-radius: 2px;
  outline: none;
  font-size: 0.9rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }

  &.is-active {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);

    &:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  }
}
</style>