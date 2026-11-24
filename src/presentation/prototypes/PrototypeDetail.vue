<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref } from "vue";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../application/knowledge";
import type { PrototypeRecord, PrototypeSourceOption } from "../../application/prototypes";
import { prototypesRoute } from "../../application/prototypes";
import { prototypeDesignFields, prototypeDesignKinds } from "../../domain/prototypes";
import { useRememberWorkspaceOrigin } from "../projects";
import { useHistory, useMessages, useNavigate, useRouting, useStream } from "../shell";
import PrototypeBriefDialog from "./PrototypeBriefDialog.vue";
import PrototypeScopeLink from "./PrototypeScopeLink.vue";
import PrototypeStatus from "./PrototypeStatus.vue";

const { record, scope } = defineProps<{
  readonly record: PrototypeRecord;
  readonly scope: PrototypeSourceOption | undefined;
}>();
const catalogs = useMessages();
const text = catalogs.prototypes;
const labels = catalogs.projects.templates.labels;
const navigate = useNavigate();
const { definition, history } = useRouting();
const { back } = useHistory();
const remember = useRememberWorkspaceOrigin();
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const editing = ref<PrototypeRecord>();
const designs = computed(() => {
  const notes = projectKnowledge(record.projectId, knowledge.value.records);
  return prototypeDesignKinds.flatMap((kind) => {
    const id = record.values[prototypeDesignFields[kind]];
    return id
      ? [{ kind, id, note: notes.find((note) => note.kind === kind && note.id === id) }]
      : [];
  });
});
let trigger: HTMLElement | undefined;

function edit(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  editing.value = record;
}

function close() {
  editing.value = undefined;
  trigger?.focus({ preventScroll: true });
}

function goBack() {
  const route = prototypesRoute(record.projectId);
  const previous = history.value.back.at(-1);
  return previous && definition.equals(previous, route) ? back() : navigate(route);
}
</script>

<template>
  <article
    class="pe-prototypes"
    :data-prototype-id="record.displayId"
    data-testid="prototype-detail"
  >
    <UButton
      type="button"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      class="pe:justify-self-start pe:p-0"
      :label="text.back"
      @click="goBack"
    />
    <header class="pe-prototype-header">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <p class="pe:text-sm pe:text-muted">
          {{ text.revision(record.displayId, record.revision) }}
        </p>
        <h1 tabindex="-1" class="pe-prototype-heading">{{ record.title }}</h1>
      </div>
      <UButton
        type="button"
        variant="soft"
        color="neutral"
        :label="text.edit"
        data-testid="prototype-edit"
        @click="edit"
      />
    </header>
    <dl class="pe-prototype-brief">
      <div>
        <dt>{{ text.scope }}</dt>
        <dd><PrototypeScopeLink :record="record" :scope="scope" /></dd>
      </div>
      <div>
        <dt>{{ text.status }}</dt>
        <dd><PrototypeStatus :record="record" /></dd>
      </div>
      <div class="pe-prototype-description">
        <dt>{{ text.description }}</dt>
        <dd>{{ record.description || text.noDescription }}</dd>
      </div>
      <div v-for="{ kind, id, note } in designs" :key="kind">
        <dt>{{ labels[kind] }}</dt>
        <dd>
          <UButton
            v-if="note"
            type="button"
            variant="link"
            class="pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-pe-focus-key="'prototype-design-' + kind"
            @click="
              remember($event.currentTarget as HTMLElement);
              navigate(knowledgeDetailRoute(record.projectId, id));
            "
            >{{ note.displayId }} · {{ note.title }}</UButton
          >
          <span v-else class="pe:text-muted">{{ text.missingSource }}</span>
        </dd>
      </div>
    </dl>
    <slot name="output" :record="record" :scope="scope" />
    <PrototypeBriefDialog
      v-if="editing"
      :project-id="record.projectId"
      :base="editing"
      @dismiss="close"
    />
  </article>
</template>
