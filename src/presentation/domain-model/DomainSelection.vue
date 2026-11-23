<script setup lang="ts">
import type { DomainEdge } from "../../application/domain-model";
import type { KnowledgeNote, KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";
import DomainEdgeInspector from "./DomainEdgeInspector.vue";
import DomainEdgeList from "./DomainEdgeList.vue";
import DomainEntityInspector from "./DomainEntityInspector.vue";

defineProps<{
  readonly entity: KnowledgeRecord | undefined;
  readonly note: KnowledgeNote | undefined;
  readonly selectedEdge: DomainEdge | undefined;
  readonly editableEdge: boolean;
  readonly names: ReadonlyMap<string, KnowledgeRecord>;
  readonly edges: readonly DomainEdge[];
  readonly hasEntities: boolean;
}>();
const emit = defineEmits<{
  select: [string];
  editEdge: [Event];
  deleteEdge: [Event];
  editEntity: [Event];
  archive: [Event];
  open: [];
}>();
const text = useMessages()["domain-model"];
</script>

<template>
  <div class="pe-domain-reading">
    <section class="pe-domain-panel" data-testid="domain-inspector">
      <DomainEdgeInspector
        v-if="selectedEdge"
        :edge="selectedEdge"
        :names="names"
        :editable="editableEdge"
        @select="emit('select', $event)"
        @edit="emit('editEdge', $event)"
        @remove="emit('deleteEdge', $event)"
      />
      <DomainEntityInspector
        v-else-if="entity"
        :record="entity"
        :note="note"
        @open="emit('open')"
        @edit="emit('editEntity', $event)"
        @archive="emit('archive', $event)"
      />
      <p v-else role="status">{{ text.missing }}</p>
    </section>
    <DomainEdgeList
      v-if="hasEntities"
      :edges="edges"
      :names="names"
      :selected="selectedEdge?.id"
      @select="emit('select', $event)"
    />
  </div>
</template>
