<script setup lang="ts">
import { ref } from "vue";
import { knowledgeShelves } from "../../application/knowledge";
import type { KnowledgeKind } from "../../application/knowledge";
import type { ActorType } from "../../domain/knowledge";
import { useMessages } from "../shell";
import type { LibraryFilter } from "./library-preferences";

const query = defineModel<string>("query", { required: true });
const filter = defineModel<LibraryFilter>("filter", { required: true });
const actor = defineModel<"" | ActorType>("actor", { required: true });
const concept = defineModel<"" | KnowledgeKind>("concept", { required: true });
const catalog = useMessages();
const text = catalog.knowledge;
const labels = catalog.projects.templates.labels;
const productKinds = [
  ...knowledgeShelves.foundations,
  ...knowledgeShelves.actors,
  ...knowledgeShelves.domain,
  ...knowledgeShelves.design,
];
const queryInput = ref<HTMLInputElement>();
defineExpose({
  focus: () => queryInput.value?.focus({ preventScroll: true }),
});
</script>

<template>
  <div
    class="pe:grid pe:min-w-0 pe:gap-3 pe:rounded-lg pe:border pe:border-default pe:bg-muted pe:p-3"
  >
    <label class="pe:grid pe:min-w-0 pe:gap-1">
      <span class="pe:text-sm pe:font-medium">{{ text.query }}</span>
      <input
        ref="queryInput"
        v-model="query"
        name="knowledge-query"
        type="search"
        :placeholder="text.placeholder"
        class="pe:w-full pe:min-w-0"
        data-pe-focus-key="knowledge-query"
      />
    </label>
    <div class="pe:flex pe:flex-wrap pe:gap-3">
      <label class="pe:grid pe:min-w-0 pe:max-w-full pe:gap-1">
        <span class="pe:text-sm pe:font-medium">{{ text.filter }}</span>
        <select v-model="filter" name="knowledge-filter" class="pe:min-w-0">
          <option value="">{{ text.all }}</option>
          <option v-for="kind in productKinds" :key="kind" :value="kind">{{ labels[kind] }}</option>
          <option value="concepts">{{ text.shelves.concepts }}</option>
          <option value="other">{{ text.shelves.other }}</option>
        </select>
      </label>
      <label v-if="filter === 'actor'" class="pe:grid pe:min-w-0 pe:max-w-full pe:gap-1">
        <span class="pe:text-sm pe:font-medium">{{ text.actorFilter }}</span>
        <select v-model="actor" name="knowledge-actor" class="pe:min-w-0">
          <option value="">{{ text.all }}</option>
          <option v-for="(label, type) in text.actorTypes" :key="type" :value="type">
            {{ label }}
          </option>
        </select>
      </label>
      <label v-if="filter === 'concepts'" class="pe:grid pe:min-w-0 pe:max-w-full pe:gap-1">
        <span class="pe:text-sm pe:font-medium">{{ text.conceptFilter }}</span>
        <select v-model="concept" name="knowledge-concept" class="pe:min-w-0">
          <option value="">{{ text.all }}</option>
          <option v-for="kind in knowledgeShelves.concepts" :key="kind" :value="kind">
            {{ labels[kind] }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>
