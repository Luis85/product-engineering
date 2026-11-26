<script setup lang="ts">
import { nfrCategories, nfrStandards } from "../../../domain/backlog";
import type { NfrCategory } from "../../../domain/backlog";
import { useMessages } from "../../shell";

const values = defineModel<readonly NfrCategory[]>({ required: true });
const text = useMessages().backlog.nfr;

function toggle(id: NfrCategory, event: Event) {
  const checked = (event.currentTarget as HTMLInputElement).checked;
  values.value = checked ? [...values.value, id] : values.value.filter((entry) => entry !== id);
}
</script>

<template>
  <div class="pe-nfr-form-categories">
    <fieldset v-for="(standard, group) in nfrStandards" :key="group" class="pe-nfr-fieldset">
      <legend>{{ standard }}</legend>
      <p class="pe:text-muted">{{ text.groups[group] }}</p>
      <div class="pe-nfr-checklist">
        <template v-for="[id, categoryGroup] in nfrCategories" :key="id">
          <label v-if="group === categoryGroup">
            <input
              type="checkbox"
              name="category"
              :value="id"
              :checked="values.includes(id)"
              @change="toggle(id, $event)"
            />
            <span>{{ text.category[id] }}</span>
          </label>
        </template>
      </div>
    </fieldset>
  </div>
</template>
