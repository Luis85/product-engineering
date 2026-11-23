<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { BacklogItem, BacklogPlacement, BacklogSnapshot } from "../../application/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogRows from "./BacklogRows.vue";
import type { BacklogRow } from "./preferences";

const { snapshot, rows, level } = defineProps<{
  readonly snapshot: BacklogSnapshot;
  readonly rows: readonly BacklogRow[];
  readonly level: BacklogKind | "";
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
  <template v-if="snapshot.issue">
    <p role="alert">{{ text.errors[snapshot.issue] }}</p>
    <UButton
      v-if="snapshot.issue === 'base'"
      type="button"
      variant="soft"
      class="pe:justify-self-start"
      :label="text.registerBase"
      @click="emit('configure')"
    />
  </template>
  <p v-else-if="!snapshot.ready" role="status">{{ text.waiting }}</p>
  <template v-else>
    <p
      v-if="snapshot.duplicates.length"
      role="alert"
      class="pe:wrap-anywhere pe:text-error"
      data-testid="backlog-duplicates"
    >
      {{ text.errors.duplicate }} {{ snapshot.duplicates.join(", ") }}
    </p>
    <BacklogRows
      v-if="rows.length"
      :rows="rows"
      :level="level"
      @open="(item, control, edit) => emit('open', item, control, edit)"
      @toggle="emit('toggle', $event)"
      @move="(key, placement) => emit('move', key, placement)"
    />
    <p v-else role="status" class="pe-backlog-empty">
      {{ snapshot.items.length ? text.noMatches : text.empty }}
    </p>
  </template>
</template>
