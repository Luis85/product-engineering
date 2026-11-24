<script setup lang="ts">
import type { BacklogItem, BacklogPlacement, BacklogSnapshot } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogResults from "./BacklogResults.vue";
import BacklogRows from "./BacklogRows.vue";
import type { BacklogRow } from "./preferences";

const { snapshot, rows, level } = defineProps<{
  readonly snapshot: BacklogSnapshot;
  readonly rows: readonly BacklogRow[];
  readonly level: BacklogKind | "";
  readonly project: ProjectId;
}>();
const emit = defineEmits<{
  configure: [];
  open: [BacklogItem, HTMLElement, boolean?];
  move: [string, BacklogPlacement];
  toggle: [string];
}>();
const text = useMessages().backlog;
</script>

<template>
  <BacklogResults :snapshot="snapshot" @configure="emit('configure')">
    <BacklogRows
      v-if="rows.length"
      :rows="rows"
      :level="level"
      :project="project"
      @open="(item, control, edit) => emit('open', item, control, edit)"
      @toggle="emit('toggle', $event)"
      @move="(key, placement) => emit('move', key, placement)"
    />
    <p v-else role="status" class="pe-backlog-empty">
      {{ snapshot.items.length ? text.noMatches : text.empty }}
    </p>
  </BacklogResults>
</template>
