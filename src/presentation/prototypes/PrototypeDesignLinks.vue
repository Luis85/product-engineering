<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { knowledgeChanges, knowledgeSnapshot, projectKnowledge } from "../../application/knowledge";
import type { PrototypeRecord } from "../../application/prototypes";
import { prototypeDesignFields, prototypeDesignKinds } from "../../domain/prototypes";
import { useMessages, useStream } from "../shell";
import { usePrototypeNoteNavigation } from "./note-navigation";

const { record } = defineProps<{ readonly record: PrototypeRecord }>();
const catalogs = useMessages();
const labels = catalogs.projects.templates.labels;
const openNote = usePrototypeNoteNavigation();
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const designs = computed(() => {
  const notes = projectKnowledge(record.projectId, knowledge.value.records);
  return prototypeDesignKinds.flatMap((kind) => {
    const id = record.values[prototypeDesignFields[kind]];
    return id
      ? [{ kind, id, note: notes.find((note) => note.kind === kind && note.id === id) }]
      : [];
  });
});
</script>

<template>
  <div v-for="{ kind, id, note } in designs" :key="kind">
    <dt>{{ labels[kind] }}</dt>
    <dd>
      <UButton
        v-if="note"
        type="button"
        variant="link"
        class="pe:p-0 pe:text-start pe:wrap-anywhere"
        :data-pe-focus-key="'prototype-design-' + kind"
        @click="openNote(record.projectId, record.id, id, $event)"
        >{{ note.displayId }} · {{ note.title }}</UButton
      >
      <span v-else class="pe:text-muted">{{ catalogs.prototypes.missingSource }}</span>
    </dd>
  </div>
</template>
