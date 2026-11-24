<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, onMounted, watch } from "vue";
import { projectChanges, projectSnapshot } from "../../application/projects";
import {
  prototypeSourcesChanges,
  prototypesChanges,
  prototypesRoute,
  prototypesSnapshot,
} from "../../application/prototypes";
import type { PrototypeRecord, PrototypeSourceOption } from "../../application/prototypes";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useAsyncStream, useMessages, useNavigate, useStream } from "../shell";
import PrototypeCreateAction from "./PrototypeCreateAction.vue";
import PrototypeDetail from "./PrototypeDetail.vue";
import PrototypeScopeLink from "./PrototypeScopeLink.vue";
import PrototypeStatus from "./PrototypeStatus.vue";

const { route } = defineProps<{ readonly route: ReturnType<typeof prototypesRoute> }>();
const projectId = route.projectId;
const text = useMessages().prototypes;
const projects = useStream(projectSnapshot, projectChanges);
const project = computed(() => projects.value.projects.find(({ id }) => id === projectId));
const prototypes = useStream(prototypesSnapshot(projectId), prototypesChanges(projectId));
const options = useAsyncStream<readonly PrototypeSourceOption[], never>(
  [],
  prototypeSourcesChanges(projectId),
);
const current = computed(
  () => project.value && prototypes.value.records.find(({ id }) => id === route.prototypeId),
);
const canCreate = computed(() => Boolean(project.value && !route.prototypeId));
const status = computed(() => {
  if (projects.value.failed || prototypes.value.failed)
    return { role: "alert", label: text.unavailable };
  if (!projects.value.ready || !prototypes.value.ready)
    return { role: "status", label: text.loading };
  if (!project.value || route.prototypeId) return { role: "status", label: text.missing };
  if (!prototypes.value.records.length) return { role: "status", label: text.empty };
  return undefined;
});
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch([prototypes, options, () => route.prototypeId], () => restore(), { flush: "post" });

function scopeFor(record: PrototypeRecord) {
  if (record.source?.projectId !== projectId) return;
  return options.value.find(
    ({ source }) => source.kind === record.source?.kind && source.id === record.source?.id,
  );
}

async function open(record: PrototypeRecord, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(prototypesRoute(projectId, record.id)))) remember(undefined);
}
</script>

<template>
  <PrototypeDetail v-if="current" :key="current.id" :record="current" :scope="scopeFor(current)" />
  <section v-else class="pe-prototypes" data-testid="prototype-register">
    <header class="pe-prototype-header">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <h1 tabindex="-1" class="pe-prototype-heading">{{ text.title }}</h1>
        <p v-if="!route.prototypeId" class="pe:text-sm pe:text-muted">{{ text.intro }}</p>
      </div>
      <PrototypeCreateAction v-if="canCreate" :project-id="projectId" />
      <UButton
        v-if="route.prototypeId"
        type="button"
        variant="link"
        color="neutral"
        :label="text.back"
        @click="navigate(prototypesRoute(projectId))"
      />
    </header>
    <p v-if="status" class="pe-prototype-brief" :role="status.role">{{ status.label }}</p>
    <table v-else class="pe-prototype-table" :aria-label="text.title">
      <thead>
        <tr>
          <th scope="col">{{ text.prototype }}</th>
          <th scope="col">{{ text.scope }}</th>
          <th scope="col">{{ text.status }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in prototypes.records"
          :key="record.id"
          :data-prototype-row="record.displayId"
        >
          <td>
            <div class="pe-prototype-identity">
              <span class="pe-prototype-glyph"
                ><UIcon name="i-lucide-panels-top-left" aria-hidden="true"
              /></span>
              <div class="pe:grid pe:min-w-0 pe:gap-0.5">
                <UButton
                  type="button"
                  variant="link"
                  class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
                  :data-pe-focus-key="'prototype-row-' + record.id"
                  @click="open(record, $event)"
                  >{{ record.title }}</UButton
                >
                <span class="pe:text-xs pe:text-muted">{{
                  text.revision(record.displayId, record.revision)
                }}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="pe-prototype-mobile-label" aria-hidden="true">{{
              text.scope
            }}</span><PrototypeScopeLink :record="record" :scope="scopeFor(record)" />
          </td>
          <td>
            <span class="pe-prototype-mobile-label" aria-hidden="true">{{
              text.status
            }}</span><PrototypeStatus :record="record" />
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
