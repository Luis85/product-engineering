<script setup lang="ts">
import { computed } from "vue";
import { nfrCategories, nfrStandards } from "../../../domain/backlog";
import type { NfrCategory } from "../../../domain/backlog";
import { useMessages } from "../../shell";

const { categories } = defineProps<{ readonly categories: readonly NfrCategory[] }>();
const text = useMessages().backlog.nfr;
const assigned = computed(() => nfrCategories.filter(([id]) => categories.includes(id)));
</script>

<template>
  <ul v-if="assigned.length" class="pe-nfr-classification">
    <li v-for="[id, standard] in assigned" :key="id">
      <span>{{ text.category[id] }}</span>
      <small>{{ nfrStandards[standard] }}</small>
    </li>
  </ul>
  <span v-else class="pe:text-muted">{{ text.unclassified }}</span>
</template>
