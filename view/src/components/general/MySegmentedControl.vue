<template>
  <div class="my-segmented">
    <label
      v-for="opt in options"
      :key="opt.value"
      :class="{ 'is-active': modelValue === opt.value }"
      v-tooltip="opt.tooltip"
    >
      <input
        type="radio"
        :value="opt.value"
        :checked="modelValue === opt.value"
        @change="emit('update:modelValue', opt.value)"
      />
      <FontAwesomeIcon v-if="opt.icon" :icon="opt.icon" />
      <span v-else>{{ opt.label }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

export interface SegmentedOption {
  value: string;
  label?: string;
  icon?: IconDefinition;
  tooltip?: string;
}

defineProps<{
  options: SegmentedOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style lang="scss">
.my-segmented {
  display: inline-flex;
  align-items: stretch;

  label {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.6rem;
    height: 2rem;
    box-sizing: border-box;
    font-size: 0.85rem;
    color: var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground));
    background-color: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.15));
    border: 1px solid var(--vscode-button-border, var(--vscode-sideBarSectionHeader-border));
    border-left-width: 0;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s, color 0.15s;

    &:first-child {
      border-left-width: 1px;
      border-top-left-radius: 3px;
      border-bottom-left-radius: 3px;
    }

    &:last-child {
      border-top-right-radius: 3px;
      border-bottom-right-radius: 3px;
    }

    input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    &:hover:not(.is-active) {
      background-color: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.3));
    }

    &.is-active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
      z-index: 1;
    }

    &:has(input:focus-visible) {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -2px;
    }
  }
}
</style>