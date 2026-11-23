<script setup lang="ts">
defineProps<{
  readonly name: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly empty?: string;
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly disabled: boolean;
}>();
const value = defineModel<string>({ required: true });
</script>

<template>
  <label class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
    <span class="pe:font-medium">{{ label }}</span>
    <select
      v-model="value"
      :name="name"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-required="required"
      class="pe:w-full pe:min-w-0"
    >
      <option v-if="empty" value="">{{ empty }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <span v-if="error" role="alert">{{ error }}</span>
  </label>
</template>
