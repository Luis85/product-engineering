<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref } from "vue";
import { rankingPeers } from "../../application/backlog";
import type { BacklogItem, BacklogPlacement } from "../../application/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";

const {
  item,
  items,
  parent,
  level = "",
  disabled = false,
} = defineProps<{
  readonly item: BacklogItem;
  readonly items: readonly BacklogItem[];
  readonly parent: string;
  readonly level?: BacklogKind | "";
  readonly disabled?: boolean;
}>();
const place = defineModel<BacklogPlacement | undefined>({ required: true });
const text = useMessages().backlog;
const controls = ref<HTMLElement>();
const destination = computed(() => parent || item.parent);
const changingParent = computed(() => destination.value !== item.parent);
const focusedLevel = computed(() => (changingParent.value ? undefined : level || undefined));
const peers = computed(() =>
  rankingPeers(items, item, focusedLevel.value, destination.value).filter(
    ({ conflict }) => !conflict,
  ),
);
const ranked = computed(() => peers.value.filter(({ key }) => key !== item.key));
const base = computed(() =>
  changingParent.value ? ranked.value.length : peers.value.findIndex(({ key }) => key === item.key),
);
const staged = computed(() => {
  const position = ranked.value.findIndex(({ key }) => key === place.value?.target);
  if (position < 0) return base.value;
  return position + (place.value?.zone === "after" ? 1 : 0);
});

function placementAt(index: number): BacklogPlacement | undefined {
  if (index === base.value) return;
  const after = index > base.value;
  const peer = ranked.value[index - (after ? 1 : 0)];
  if (!peer) return;
  const focus = focusedLevel.value;
  return { target: peer.key, zone: after ? "after" : "before", ...(focus && { level: focus }) };
}

async function move(direction: -1 | 1) {
  const index = staged.value + direction;
  place.value = placementAt(index);
  if (index === 0 || index === ranked.value.length) {
    await nextTick();
    controls.value
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
  }
}
</script>

<template>
  <div v-if="base >= 0" ref="controls" class="pe-backlog-actions">
    <output class="pe:text-sm pe:text-muted" aria-live="polite">{{
      text.rankOf(staged + 1, ranked.length + 1)
    }}</output>
    <UButton
      type="button"
      variant="soft"
      color="neutral"
      size="sm"
      data-testid="backlog-up"
      :disabled="disabled || staged === 0"
      :label="text.higher"
      @click="move(-1)"
    />
    <UButton
      type="button"
      variant="soft"
      color="neutral"
      size="sm"
      data-testid="backlog-down"
      :disabled="disabled || staged >= ranked.length"
      :label="text.lower"
      @click="move(1)"
    />
  </div>
</template>
