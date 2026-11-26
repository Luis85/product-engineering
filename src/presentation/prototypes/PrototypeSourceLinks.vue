<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, watch } from "vue";
import {
  prototypesChanges,
  prototypesForSource,
  prototypesRoute,
  prototypesSnapshot,
} from "../../application/prototypes";
import type { PrototypeId, PrototypeSource } from "../../domain/prototypes";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useMessages, useNavigate, useStream } from "../shell";
import PrototypeCreateAction from "./PrototypeCreateAction.vue";
import PrototypeStatus from "./PrototypeStatus.vue";

const {
  source,
  displayId = undefined,
  empty = undefined,
} = defineProps<{
  readonly source: PrototypeSource;
  readonly displayId?: string | undefined;
  readonly empty?: string | undefined;
}>();
const text = useMessages().prototypes;
const snapshot = useStream(
  prototypesSnapshot(source.projectId),
  prototypesChanges(source.projectId),
);
const linked = computed(() => prototypesForSource(snapshot.value.records, source));
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const navigate = useNavigate();
watch(linked, () => restore(), { flush: "post" });

async function open(id: PrototypeId, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(prototypesRoute(source.projectId, id)))) remember(undefined);
}
</script>

<template>
  <section
    class="pe-prototype-links"
    :aria-label="text.scopeRegion(displayId ?? source.id)"
    data-testid="prototype-source-links"
  >
    <div class="pe-prototype-header">
      <h2 class="pe:text-sm pe:font-semibold">{{ text.title }}</h2>
      <PrototypeCreateAction :project-id="source.projectId" :source="source" />
    </div>
    <p v-if="!linked.length && snapshot.ready" class="pe:text-muted">{{ empty ?? text.noLinks }}</p>
    <ul v-else class="pe:grid pe:gap-2">
      <li
        v-for="record in linked"
        :key="record.id"
        class="pe-prototype-link-row"
        :data-prototype-link="record.displayId"
      >
        <div class="pe:grid pe:min-w-0 pe:gap-0.5">
          <UButton
            type="button"
            variant="link"
            class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-pe-focus-key="'prototype-link-' + record.id"
            @click="open(record.id, $event)"
            >{{ record.title }}</UButton
          >
          <span class="pe:text-xs pe:text-muted">{{
            text.revision(record.displayId, record.revision)
          }}</span>
        </div>
        <PrototypeStatus :record="record" />
      </li>
    </ul>
  </section>
</template>
