<script setup lang="ts">
const {
  name,
  label,
  all,
  options,
  labels = undefined,
} = defineProps<{
  readonly name: string;
  readonly label: string;
  readonly all: string;
  readonly options: readonly string[];
  readonly labels?: Readonly<Record<string, string>> | undefined;
}>();
const value = defineModel<string>({ required: true });
</script>

<template>
  <select v-model="value" :name="name" :aria-label="label">
    <option value="">{{ all }}</option>
    <option v-for="option in options" :key="option" :value="option">
      {{ labels?.[option] ?? option }}
    </option>
  </select>
</template>
