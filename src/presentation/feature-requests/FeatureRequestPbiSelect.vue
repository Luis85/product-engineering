<script setup lang="ts">
import UFormField from "@nuxt/ui/components/FormField.vue";
import { useMessages } from "../shell";

defineProps<{
  readonly options: readonly { readonly id: string; readonly title: string }[];
  readonly value: string;
  readonly invalid: boolean;
  readonly locked: boolean;
  readonly contextual: boolean;
}>();
const emit = defineEmits<{ change: [string] }>();
const text = useMessages()["feature-requests"];
</script>

<template>
  <UFormField :label="text.pbi" :error="invalid ? text.errors.pbi : false">
    <select
      name="pbiId"
      class="pe-request-select"
      :value="value"
      :aria-label="text.pbi"
      :aria-invalid="invalid"
      :disabled="locked"
      :data-autofocus="!contextual || undefined"
      required
      @change="emit('change', ($event.currentTarget as HTMLSelectElement).value)"
    >
      <option value="">{{ text.choosePbi }}</option>
      <option v-for="{ id, title } in options" :key="id" :value="id">{{ id }} · {{ title }}</option>
    </select>
  </UFormField>
</template>
