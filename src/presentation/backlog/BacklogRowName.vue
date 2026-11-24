<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { ProjectId } from "../../application/projects";
import { backlogPrototypeSource } from "../../application/prototypes";
import { PrototypeCreateAction } from "../prototypes";
import { useMessages } from "../shell";
import type { BacklogRow } from "./preferences";

const { row, project } = defineProps<{ readonly row: BacklogRow; readonly project: ProjectId }>();
const source = computed(() => backlogPrototypeSource(project, row.item));
const emit = defineEmits<{ open: [HTMLElement, boolean?]; toggle: [] }>();
const text = useMessages().backlog;
const editablePbi = computed(
  () => row.item.kind === "UC" && row.item.adopted && !row.item.conflict,
);
const label = computed(() => (row.expanded ? text.collapse : text.expand) + " " + row.item.title);
const issue = computed(() =>
  row.item.conflict ? text.errors.identity : row.item.brokenParent ? text.suppliedParent : "",
);

function disclose(expanded: boolean) {
  if (row.expanded !== expanded) emit("toggle");
}
</script>

<template>
  <div role="cell" class="pe-backlog-name">
    <UButton
      v-if="row.hasChildren"
      type="button"
      variant="ghost"
      color="neutral"
      size="xs"
      class="pe-backlog-disclose"
      :icon="row.expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
      :aria-label="label"
      :aria-expanded="row.expanded"
      :disabled="row.fixed"
      @click="emit('toggle')"
      @keydown.left.prevent="disclose(false)"
      @keydown.right.prevent="disclose(true)"
    />
    <span v-else class="pe-backlog-disclose" aria-hidden="true" />
    <span class="pe-backlog-badge">{{ text.types[row.item.kind] }}</span>
    <div class="pe:min-w-0">
      <UButton
        type="button"
        variant="link"
        color="neutral"
        class="pe:min-w-0 pe:max-w-full pe:p-0 pe:text-start"
        :data-pe-focus-key="'backlog-' + row.item.key"
        data-testid="backlog-row-open"
        @click="emit('open', $event.currentTarget as HTMLElement)"
        ><span class="pe:wrap-anywhere pe:whitespace-normal">{{ row.item.title }}</span></UButton
      >
      <span v-if="row.item.id" class="pe:ms-2 pe:text-xs pe:text-muted">{{ row.item.id }}</span>
      <UButton
        v-if="editablePbi"
        type="button"
        variant="ghost"
        color="neutral"
        size="xs"
        :label="text.edit"
        :aria-label="text.edit + ' · ' + row.item.title"
        :data-pe-focus-key="'backlog-edit-' + row.item.key"
        data-testid="backlog-row-edit"
        @click="emit('open', $event.currentTarget as HTMLElement, true)"
      />
      <PrototypeCreateAction
        v-if="source"
        :project-id="project"
        :source="source"
        :display-id="row.item.id"
        compact
      />
      <span v-if="row.lineage" class="pe:block pe:wrap-anywhere pe:text-xs pe:text-muted">{{
        row.lineage
      }}</span>
      <span
        v-if="issue"
        class="pe:block pe:text-xs"
        :class="row.item.conflict ? 'pe:text-error' : 'pe:text-muted'"
        >{{ issue }}</span
      >
      <slot />
    </div>
  </div>
</template>
