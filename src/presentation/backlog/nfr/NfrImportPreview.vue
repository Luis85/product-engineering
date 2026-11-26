<script setup lang="ts">
import type { NfrCsvIssue, NfrCsvPreview } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import NfrClassification from "./NfrClassification.vue";

defineProps<{
  readonly preview: NfrCsvPreview;
  readonly created: number;
  readonly skipped: number;
}>();
const text = useMessages().backlog.nfr;
const diagnosis = ({ code }: NfrCsvIssue) => text.issues[code];
</script>

<template>
  <section data-testid="nfr-preview" :aria-label="text.previewTitle" class="pe-nfr-preview">
    <h3>{{ text.previewTitle }}</h3>
    <p role="status">{{ text.previewCount(created, skipped) }}</p>
    <ul v-if="preview.issues.length" role="alert">
      <li v-for="(issue, index) in preview.issues" :key="index">
        <strong>{{ text.row(issue.line) }}</strong> · {{ diagnosis(issue) }}
        <span v-if="issue.value"> ({{ issue.value }})</span>
      </li>
    </ul>
    <ul class="pe-nfr-preview-rows">
      <template v-for="entry in preview.rows" :key="entry.line">
        <li v-if="entry.status !== 'invalid'">
          <small
            >{{ text.row(entry.line) }} ·
            {{ entry.status === "new" ? text.newRow : text.skipped }}</small
          >
          <strong>{{ entry.values.title }}</strong>
          <p>{{ entry.values.requirement }}</p>
          <p>{{ text.acceptance }} · {{ entry.values.acceptance }}</p>
          <NfrClassification :categories="entry.values.categories" />
        </li>
      </template>
    </ul>
  </section>
</template>
