<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef } from "vue";
import type { BacklogEdit } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { pbiCriteria, pbiFeature } from "../../domain/backlog";
import type { PbiCriterion } from "../../domain/backlog";
import { useMessages } from "../shell";
import PbiCriterionEditor from "./PbiCriterionEditor.vue";

const { project, entry } = defineProps<{
  readonly project: ProjectId;
  readonly entry: BacklogEdit;
}>();
const emit = defineEmits<{ saved: [] }>();
const catalog = useMessages();
const text = catalog.backlog;
const criteria = computed(() => pbiCriteria(entry.item.fields.pbi_criteria));
const editor = shallowRef<{ entry: BacklogEdit; criterion: PbiCriterion | undefined }>();
const feature = computed(() =>
  pbiFeature(
    { id: entry.item.key, title: entry.item.title },
    criteria.value ?? [],
    catalog.shell.language,
  ),
);
let trigger: HTMLElement | undefined;

function edit(event: MouseEvent, criterion?: PbiCriterion) {
  trigger = event.currentTarget as HTMLElement;
  editor.value = { entry, criterion };
}

function dismiss() {
  editor.value = undefined;
  trigger?.focus({ preventScroll: true });
}

function download(event: MouseEvent) {
  const owner = (event.currentTarget as HTMLElement).ownerDocument;
  const browser = owner.defaultView;
  if (!browser || !feature.value) return;
  const file = owner.createElement("a");
  const url = browser.URL.createObjectURL(
    new browser.Blob([feature.value], { type: "text/plain;charset=utf-8" }),
  );
  file.href = url;
  file.download = entry.item.key + ".feature";
  file.click();
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 0);
}
</script>

<template>
  <section class="pe:grid pe:min-w-0 pe:gap-3" :aria-label="text.criteria.title">
    <div class="pe-backlog-actions pe:justify-between">
      <h2 class="pe:font-semibold">{{ text.criteria.title }}</h2>
      <UButton
        v-if="criteria"
        type="button"
        :label="text.criteria.add"
        data-testid="pbi-add-criterion"
        @click="edit($event)"
      />
    </div>
    <p v-if="!criteria" role="alert">{{ text.errors.criteria }}</p>
    <p v-else-if="!criteria.length" class="pe:text-muted">{{ text.criteria.empty }}</p>
    <ul v-else class="pe:grid pe:gap-2">
      <li
        v-for="criterion in criteria"
        :key="criterion.id"
        class="pe:grid pe:gap-1 pe:rounded-md pe:border pe:border-default pe:p-3"
      >
        <UButton
          type="button"
          variant="link"
          class="pe:justify-self-start pe:p-0 pe:text-start"
          data-testid="pbi-edit-criterion"
          :label="criterion.text || text.criteria.edit"
          @click="edit($event, criterion)"
        />
        <span class="pe:wrap-anywhere pe:text-xs pe:text-muted"
          >{{ criterion.id }} · {{ criterion.scenario_id }}</span
        >
      </li>
    </ul>
    <div v-if="feature" class="pe-backlog-actions pe:justify-between">
      <h2 class="pe:font-semibold">{{ text.criteria.specification }}</h2>
      <UButton
        type="button"
        variant="soft"
        :label="text.criteria.download"
        data-testid="pbi-download-gherkin"
        @click="download"
      />
    </div>
    <pre
      v-if="feature"
      class="pe:rounded-md pe:bg-muted pe:p-3 pe:wrap-anywhere pe:whitespace-pre-wrap"
      data-testid="pbi-gherkin"
      >{{ feature }}</pre>
  </section>
  <PbiCriterionEditor
    v-if="editor"
    :project="project"
    :entry="editor.entry"
    :criterion="editor.criterion"
    @dismiss="dismiss"
    @saved="emit('saved')"
  />
</template>
