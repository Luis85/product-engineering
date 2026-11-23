<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { KnowledgeNote, KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";
import DomainScopeLinks from "./DomainScopeLinks.vue";

const { record, note } = defineProps<{
  readonly record: KnowledgeRecord;
  readonly note: KnowledgeNote | undefined;
}>();
const emit = defineEmits<{ open: []; edit: [Event]; archive: [Event] }>();
const text = useMessages()["domain-model"];
const body = computed(() => note?.body.trim());
const editable = computed(() => note?.editable && !note.values.domain_archived);
</script>

<template>
  <h2 class="pe:wrap-anywhere pe:text-xl pe:font-semibold">{{ record.title }}</h2>
  <p class="pe:text-sm pe:text-muted">{{ record.displayId }}</p>
  <p v-if="record.values.domain_archived" class="pe:text-sm pe:text-muted">{{ text.archived }}</p>
  <p v-if="body" class="pe:wrap-anywhere pe:whitespace-pre-wrap">{{ body }}</p>
  <dl v-if="record.values.domain_attributes" class="pe:grid pe:gap-2">
    <div v-for="attribute in record.values.domain_attributes" :key="attribute.name">
      <dt class="pe:wrap-anywhere pe:font-medium">{{ attribute.name }}</dt>
      <dd class="pe:wrap-anywhere pe:text-muted">{{ attribute.description }}</dd>
    </div>
  </dl>
  <div class="pe:flex pe:flex-wrap pe:gap-2">
    <UButton
      type="button"
      variant="soft"
      data-testid="domain-knowledge-note"
      @click="emit('open')"
      >{{ text.openNote }}</UButton
    >
    <template v-if="editable">
      <UButton
        type="button"
        variant="soft"
        data-testid="domain-edit-entity"
        @click="emit('edit', $event)"
        >{{ text.editEntity }}</UButton
      >
      <UButton
        type="button"
        variant="ghost"
        color="error"
        data-testid="domain-archive-entity"
        @click="emit('archive', $event)"
        >{{ text.archiveEntity }}</UButton
      >
    </template>
  </div>
  <DomainScopeLinks :key="record.id" :note="record" from-model />
</template>
