<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { pbiSourceDraft, savePbiReferences } from "../../application/backlog";
import type { PbiDetail } from "../../application/backlog";
import { DomainScopeLinks } from "../domain-model";
import { KnowledgeReferences } from "../knowledge";
import { ErrorNotice, useCommand, useMessages, useNavigationGuard } from "../shell";

const { detail } = defineProps<{ readonly detail: PbiDetail }>();
const emit = defineEmits<{
  edit: [];
  saved: [];
  open: [NonNullable<PbiDetail["sources"][number]["record"]>, MouseEvent];
}>();
const text = useMessages().backlog;
const requirement = computed(() => pbiSourceDraft(detail.edit.item.fields).pbi_requirement_id);
const links = computed(() =>
  detail.sources
    .filter(({ id }) => id)
    .map((source) => ({
      ...source,
      requirement: source.kind === "prd" ? requirement.value : "",
      missingRequirement: source.record?.values.requirement_id !== requirement.value,
    })),
);
const save = useCommand(savePbiReferences);
useNavigationGuard(() => !save.pending.value);

async function update(references: readonly string[]) {
  const result = await save.run(detail.projectId, detail.edit, references);
  if (result._tag === "success") emit("saved");
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-5">
    <section
      class="pe:grid pe:min-w-0 pe:gap-2"
      :aria-label="text.sources.title"
      data-testid="pbi-sources"
    >
      <div class="pe-backlog-actions pe:justify-between">
        <h2 class="pe:font-semibold">{{ text.sources.title }}</h2>
        <UButton type="button" variant="soft" :label="text.sources.attach" @click="emit('edit')" />
      </div>
      <p v-if="!links.length" class="pe:text-muted">{{ text.sources.empty }}</p>
      <ul v-else class="pe:grid pe:gap-1">
        <li
          v-for="{ kind, id, record, requirement: req, missingRequirement } in links"
          :key="kind"
          class="pe:wrap-anywhere"
        >
          <span class="pe:block pe:text-sm pe:text-muted">{{ text.sources.kinds[kind] }}</span>
          <UButton
            v-if="record"
            type="button"
            variant="link"
            class="pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-testid="'pbi-source-' + kind"
            :data-pe-focus-key="'pbi-source-' + kind"
            @click="emit('open', record, $event)"
          >
            {{ record.displayId }} · {{ record.title }}
          </UButton>
          <p v-else role="status">{{ id }} · {{ text.sources.missing }}</p>
          <p :hidden="!req" :class="{ 'pe:text-error': missingRequirement }">
            {{ missingRequirement ? req + " · " + text.sources.missing : req }}
          </p>
        </li>
      </ul>
    </section>
    <DomainScopeLinks :item="{ id: detail.pbiId, projectId: detail.projectId }" from-pbi />
    <KnowledgeReferences
      :source="detail.edit.item.path"
      :references="detail.references"
      :editable="!save.pending.value"
      @change="update"
    />
    <ErrorNotice v-if="save.message.value" :message="save.message.value" />
  </div>
</template>
