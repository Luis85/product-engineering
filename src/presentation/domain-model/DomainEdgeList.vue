<script setup lang="ts">
import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";

defineProps<{
  readonly edges: readonly DomainEdge[];
  readonly selected: string | undefined;
  readonly names: ReadonlyMap<string, KnowledgeRecord>;
}>();
const emit = defineEmits<{ select: [string] }>();
const text = useMessages()["domain-model"];
</script>

<template>
  <section class="pe-domain-panel" data-testid="domain-edges">
    <h2 class="pe:text-base pe:font-semibold">{{ text.relationships }}</h2>
    <p v-if="!edges.length" class="pe:text-sm pe:text-muted">{{ text.noRelationships }}</p>
    <ul v-else class="pe:grid pe:min-w-0 pe:gap-2">
      <li v-for="edge in edges" :key="edge.id">
        <button
          type="button"
          class="pe-domain-edge-row"
          :aria-pressed="selected === edge.id"
          :data-domain-edge-row="edge.id"
          :data-pe-focus-key="'edge-' + edge.id"
          @click="emit('select', edge.id)"
        >
          <span
            >{{ names.get(edge.source)?.title }} <strong>{{ edge.verb }}</strong>
            {{ names.get(edge.target)?.title }}</span
          >
          <small>{{ edge.sourceCardinality }} → {{ edge.targetCardinality }}</small>
        </button>
      </li>
    </ul>
  </section>
</template>
