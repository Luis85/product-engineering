<script setup lang="ts">
import { ref } from "vue";
import { ownerName } from "../../application/backlog";
import type { BacklogItem, BacklogPlacement } from "../../application/backlog";
import { parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import type { BacklogRow } from "./preferences";
import BacklogRowName from "./BacklogRowName.vue";

const { rows, level } = defineProps<{
  readonly rows: readonly BacklogRow[];
  readonly level: BacklogKind | "";
}>();
const emit = defineEmits<{
  toggle: [string];
  open: [BacklogItem, HTMLElement, boolean?];
  move: [string, BacklogPlacement];
}>();
const text = useMessages().backlog;
const dragged = ref<BacklogItem>();
const target = ref<BacklogPlacement>();

function start(item: BacklogItem, event: DragEvent) {
  if (item.conflict || !event.dataTransfer) return;
  dragged.value = item;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-product-engineering-backlog", "item");
}

function end() {
  dragged.value = undefined;
  target.value = undefined;
}

function dropPlacement(
  source: BacklogItem,
  item: BacklogItem,
  fraction: number,
): BacklogPlacement | undefined {
  const inside = fraction > 0.28 && fraction < 0.72;
  const peers = level === source.kind ? item.kind === source.kind : item.parent === source.parent;
  if (inside ? item.kind !== parentKind(source.kind) : !peers) return;
  return {
    target: item.key,
    zone: inside ? "inside" : fraction < 0.5 ? "before" : "after",
    ...(level && { level }),
  };
}

function over(item: BacklogItem, event: DragEvent) {
  const source = dragged.value;
  if (!source || source.key === item.key || item.conflict) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  target.value = dropPlacement(source, item, (event.clientY - rect.top) / rect.height);
  if (!target.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}

function drop(item: BacklogItem, event: DragEvent) {
  if (dragged.value && target.value?.target === item.key) {
    event.preventDefault();
    emit("move", dragged.value.key, target.value);
  }
  end();
}

function metadata(item: BacklogItem) {
  return [
    { id: "owner", label: text.owner, value: ownerName(item.owner) },
    { id: "state", label: text.status, value: item.state },
    { id: "priority", label: text.priority, value: item.priority },
  ];
}
</script>

<template>
  <div class="pe-backlog-table" role="table" :aria-label="text.title">
    <div role="row" class="pe-backlog-head">
      <span role="columnheader">{{ text.titleField }}</span>
      <span role="columnheader">{{ text.owner }}</span>
      <span role="columnheader">{{ text.status }}</span>
      <span role="columnheader">{{ text.priority }}</span>
    </div>
    <div
      v-for="row in rows"
      :key="row.item.key"
      role="row"
      class="pe-backlog-row"
      :style="{ '--pe-backlog-depth': row.depth }"
      :data-backlog-id="row.item.id"
      :data-backlog-key="row.item.key"
      :data-backlog-context="row.context || undefined"
      :data-backlog-drop="target?.target === row.item.key ? target.zone : undefined"
      :draggable="!row.item.conflict"
      @dragstart="start(row.item, $event)"
      @dragover="over(row.item, $event)"
      @dragend="end"
      @drop="drop(row.item, $event)"
    >
      <BacklogRowName
        :row="row"
        @open="(control, edit) => emit('open', row.item, control, edit)"
        @toggle="emit('toggle', row.item.key)"
      />
      <div
        v-for="{ id, label, value } in metadata(row.item)"
        :key="id"
        role="cell"
        class="pe-backlog-meta"
        :data-testid="'backlog-row-' + id"
      >
        <template v-if="value">
          <span class="pe-backlog-narrow-label">{{ label }}</span>
          <span>{{ value }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
