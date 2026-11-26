<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref } from "vue";
import type { ProjectId } from "../../application/projects";
import { prototypesRoute } from "../../application/prototypes";
import type { PrototypeId, PrototypeSource } from "../../domain/prototypes";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate } from "../shell";
import PrototypeBriefDialog from "./PrototypeBriefDialog.vue";

const {
  projectId,
  source = undefined,
  displayId = undefined,
  compact = false,
} = defineProps<{
  readonly projectId: ProjectId;
  readonly source?: PrototypeSource | undefined;
  readonly displayId?: string | undefined;
  readonly compact?: boolean;
}>();
const text = useMessages().prototypes;
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const open = ref(false);
let trigger: HTMLElement | undefined;
const appearance = computed(() => ({
  color: source ? "neutral" : "primary",
  variant: compact ? "ghost" : source ? "soft" : "solid",
  size: compact ? "xs" : "sm",
  icon: compact ? "i-lucide-panels-top-left" : "i-lucide-plus",
  label: compact ? "" : text.create,
}));
const compactLabel = computed(() => (compact ? text.createFor(displayId ?? "") : undefined));
const testId = computed(() => (compact ? "prototype-create-compact" : "prototype-create"));
const focusKey = computed(() => (source ? `${testId.value}-${source.id}` : testId.value));

function start(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  open.value = true;
}

async function dismiss(id?: PrototypeId) {
  open.value = false;
  await nextTick();
  trigger?.focus({ preventScroll: true });
  if (!id) return;
  remember(trigger);
  if (!(await navigate(prototypesRoute(projectId, id)))) remember(undefined);
}
</script>

<template>
  <UButton
    type="button"
    v-bind="appearance"
    :aria-label="compactLabel"
    :data-pe-focus-key="focusKey"
    :data-testid="testId"
    @click="start"
  />
  <PrototypeBriefDialog v-if="open" :project-id="projectId" :source="source" @dismiss="dismiss" />
</template>
