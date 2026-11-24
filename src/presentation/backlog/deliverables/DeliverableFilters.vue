<script setup lang="ts">
import { knowledgeKinds } from "../../../application/knowledge";
import { deliverableStatuses } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import type { DeliverableFilters } from "./register-rows";

const filters = defineModel<DeliverableFilters>({ required: true });
const texts = useMessages();
const text = texts.backlog.deliverables;
</script>

<template>
  <div class="pe-deliverable-filters">
    <label>
      {{ text.search }}
      <input
        v-model="filters.query"
        name="deliverable-search"
        type="search"
        data-testid="deliverable-search"
        data-pe-focus-key="deliverable-search"
        :placeholder="text.queryHint"
      />
    </label>
    <label>
      {{ text.filterStatus }}
      <select
        v-model="filters.status"
        name="deliverable-filter-status"
        data-testid="deliverable-filter-status"
        data-pe-focus-key="deliverable-filter-status"
      >
        <option value="">{{ text.allStatuses }}</option>
        <option v-for="status in deliverableStatuses" :key="status" :value="status">
          {{ text.statuses[status] }}
        </option>
      </select>
    </label>
    <label>
      {{ text.filterTemplate }}
      <select
        v-model="filters.template"
        name="deliverable-filter-template"
        data-testid="deliverable-filter-template"
      >
        <option value="">{{ text.allTemplates }}</option>
        <option value="untyped">{{ text.withoutTemplate }}</option>
        <option v-for="kind in knowledgeKinds" :key="kind" :value="kind">
          {{ texts.projects.templates.labels[kind] }}
        </option>
      </select>
    </label>
  </div>
</template>
