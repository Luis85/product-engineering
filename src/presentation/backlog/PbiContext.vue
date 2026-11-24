<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef, watch } from "vue";
import { backlogDomainContribution } from "../../application/backlog";
import type { PbiDetail } from "../../application/backlog";
import { entityRecords, resolveDomainScope } from "../../application/domain-model";
import { knowledgeChanges, knowledgeSnapshot } from "../../application/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { useRestoreWorkspacePosition } from "../projects";
import { ErrorNotice, useMessages, useQuery, useStream } from "../shell";
import NfrSourceLinks from "./nfr/NfrSourceLinks.vue";

const { detail } = defineProps<{ readonly detail: PbiDetail }>();
const emit = defineEmits<{ open: [KnowledgeId, MouseEvent]; links: [MouseEvent] }>();
const texts = useMessages().backlog;
const text = texts.pbiContext;
const restore = useRestoreWorkspacePosition();
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const projectEntities = computed(() => entityRecords(detail.projectId, knowledge.value.records));
const scope = useQuery((current: PbiDetail) =>
  resolveDomainScope(
    current.projectId,
    [{ kind: "item", id: current.pbiId }],
    backlogDomainContribution,
  ),
);
const entities = shallowRef<NonNullable<typeof scope.value.value>["entities"]>([]);

watch(
  [() => detail, projectEntities],
  async ([current]) => {
    const result = await scope.run(current);
    if (result._tag === "success") entities.value = result.value.entities;
  },
  { immediate: true },
);
watch(entities, () => restore(), { flush: "post" });
</script>

<template>
  <div class="pe-pbi-context" data-testid="pbi-context">
    <section>
      <h2>{{ text.prototypes }}</h2>
      <p>{{ text.noPrototypes }}</p>
    </section>
    <NfrSourceLinks :project="detail.projectId" :item-id="detail.pbiId" show-scope />
    <section>
      <div class="pe-backlog-actions pe:justify-between">
        <h2>{{ text.entities }}</h2>
        <UButton
          type="button"
          variant="link"
          color="neutral"
          size="xs"
          class="pe:p-0"
          :label="texts.pbiTabs.links"
          @click="emit('links', $event)"
        />
      </div>
      <p v-if="!entities.length && !scope.pending.value">{{ text.noEntities }}</p>
      <ul v-else class="pe:grid pe:min-w-0 pe:gap-1">
        <li v-for="entity in entities" :key="entity.id" class="pe:grid pe:min-w-0 pe:gap-0.5">
          <UButton
            type="button"
            variant="link"
            class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-pe-focus-key="'pbi-entity-' + entity.id"
            @click="emit('open', entity.id, $event)"
            >{{ entity.title }}</UButton
          >
          <UButton
            v-for="origin in entity.origins.filter(({ kind }) => kind === 'prd')"
            :key="origin.id"
            type="button"
            variant="link"
            color="neutral"
            size="xs"
            class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-pe-focus-key="'pbi-entity-origin-' + entity.id + '-' + origin.id"
            @click="emit('open', origin.id as KnowledgeId, $event)"
            >{{ origin.title }}</UButton
          >
        </li>
      </ul>
      <ErrorNotice v-if="scope.message.value" :message="scope.message.value" />
    </section>
  </div>
</template>
