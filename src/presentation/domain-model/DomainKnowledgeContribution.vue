<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref } from "vue";
import {
  domainEdges,
  domainModelRoute,
  entityRecords,
  setEntityArchived,
} from "../../application/domain-model";
import { knowledgeChanges, knowledgeSnapshot } from "../../application/knowledge";
import type { KnowledgeNote } from "../../application/knowledge";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useNavigate,
  useNavigationGuard,
  useStream,
} from "../shell";
import DomainScopeLinks from "./DomainScopeLinks.vue";

const { note } = defineProps<{ readonly note: KnowledgeNote }>();
const text = useMessages()["domain-model"];
const index = useStream(knowledgeSnapshot, knowledgeChanges);
const entities = computed(() => entityRecords(note.projectId, index.value.records));
const current = computed(() => entities.value.find(({ id }) => id === note.id) ?? note);
const names = computed(
  () => new Map<string, string>(entities.value.map(({ id, title }) => [id, title])),
);
const relationships = computed(() =>
  domainEdges(entities.value)
    .filter(({ source, target }) => source === note.id || target === note.id)
    .map(({ id, source, verb, target }) => ({
      id,
      label: `${names.value.get(source) ?? source} ${verb} ${names.value.get(target) ?? target}`,
    })),
);
const canRestore = computed(() => note.editable && current.value.values.domain_archived);
const navigate = useNavigate();
const { pending, message, run: restore } = useCommand(setEntityArchived);
useNavigationGuard(() => !pending.value);
const openButton = ref<{ $el: HTMLElement }>();

function show(id: string) {
  return navigate(domainModelRoute(note.projectId, id));
}

async function restoreEntity() {
  if ((await restore(note, false))._tag === "success") {
    await nextTick();
    openButton.value?.$el.focus({ preventScroll: true });
  }
}
</script>

<template>
  <section
    v-if="note.kind === 'entity'"
    class="pe:grid pe:min-w-0 pe:gap-2"
    data-testid="domain-knowledge"
  >
    <h2 class="pe:text-base pe:font-semibold">{{ text.title }}</h2>
    <p v-if="current.values.domain_archived" class="pe:text-sm pe:text-muted">
      {{ text.archived }}
    </p>
    <div class="pe:flex pe:flex-wrap pe:gap-2">
      <UButton
        ref="openButton"
        type="button"
        variant="soft"
        size="sm"
        data-testid="domain-model-link"
        @click="show(note.id)"
        >{{ text.openModel }}</UButton
      >
      <UButton
        v-if="canRestore"
        type="button"
        variant="soft"
        size="sm"
        :loading="pending"
        data-testid="domain-restore-entity"
        @click="restoreEntity"
        >{{ text.restoreEntity }}</UButton
      >
    </div>
    <ul v-if="relationships.length" class="pe:grid pe:min-w-0 pe:gap-1">
      <li v-for="edge in relationships" :key="edge.id">
        <UButton
          type="button"
          color="neutral"
          variant="link"
          class="pe:min-w-0 pe:max-w-full pe:text-start"
          :data-domain-knowledge-edge="edge.id"
          @click="show(edge.id)"
        >
          <span class="pe:min-w-0 pe:wrap-anywhere pe:whitespace-normal">{{ edge.label }}</span>
        </UButton>
      </li>
    </ul>
    <ErrorNotice v-if="message" :message="message" />
  </section>
  <DomainScopeLinks :note="note" />
</template>
