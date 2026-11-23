<script setup lang="ts">
const { name, label, all, options } = defineProps<{
  readonly name: string;
  readonly label: string;
  readonly all: string;
  readonly options: readonly string[];
}>();
const value = defineModel<string>({ required: true });
</script>

<template>
  <select v-model="value" :name="name" :aria-label="label">
    <option value="">{{ all }}</option>
    <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
  </select>
</template>
