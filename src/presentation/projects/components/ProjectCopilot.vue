<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import USlideover from "@nuxt/ui/components/Slideover.vue";
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { aiCapability } from "../../../application/integrations";
import type { Project } from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { useMessages, useModal, useNavigate, useRoute, useRouting, useSettings } from "../../shell";
import { useRememberWorkspaceOrigin } from "../workspace-position";
import type { CopilotEntry } from "../copilot-entry";

const {
  focusWorkspace,
  followCitation,
  holdScroll,
  project,
  entry = undefined,
} = defineProps<{
  readonly focusWorkspace: () => void;
  readonly followCitation: (route: Route, origin?: HTMLElement) => Promise<boolean>;
  readonly holdScroll: () => () => void;
  readonly project: Project;
  readonly entry?: CopilotEntry | undefined;
}>();
const catalog = useMessages();
const text = catalog.projects;
const { definition } = useRouting();
const navigate = useNavigate();
const route = useRoute();
const rememberOrigin = useRememberWorkspaceOrigin();
const settings = useSettings();
const assistant = definition.context ? defineAsyncComponent(definition.context) : undefined;
const capability = computed(() => aiCapability(settings.value));
const open = ref(false);
const narrow = ref(false);
const review = ref(false);
const workspaceKey = ref(0);
const heading = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
let openedFrom: Route | undefined;
let restoreScroll: (() => void) | undefined;
let settingsChanged = false;
let navigating = false;
const modal = useModal(
  computed(() => narrow.value && open.value),
  () => {
    if (navigating) return;
    if (
      settingsChanged ||
      !trigger?.isConnected ||
      !openedFrom ||
      !definition.equals(openedFrom, route.value)
    ) {
      focusWorkspace();
      return;
    }
    trigger.focus({ preventScroll: true });
    restoreScroll?.();
  },
  () => {
    open.value = false;
  },
);
const sheetContent = computed(() => ({
  ...modal,
  "aria-modal": narrow.value ? ("true" as const) : undefined,
}));
watch(
  capability,
  (next, previous) => {
    if (!open.value || (next.enabled === previous.enabled && next.mode === previous.mode)) return;
    settingsChanged = true;
    open.value = false;
  },
  { flush: "sync" },
);

function show(target: HTMLElement, contextual = false) {
  if (!capability.value.enabled) return;
  settingsChanged = false;
  navigating = false;
  openedFrom = route.value;
  restoreScroll = holdScroll();
  const width = target.closest(".product-engineering-root")?.getBoundingClientRect().width;
  narrow.value = width !== undefined && width > 0 && width <= 760;
  trigger = target;
  if (contextual && open.value) {
    workspaceKey.value += 1;
    void nextTick(() => heading.value?.focus({ preventScroll: true }));
  }
  review.value = contextual;
  open.value = true;
}

watch(
  () => entry,
  (next) => {
    if (next) show(next.trigger, next.review);
  },
);

async function openDestination(destination: Route) {
  const same = definition.equals(route.value, destination);
  rememberOrigin(trigger);
  await closeForNavigation();
  if (await navigate(destination)) {
    if (same) focusWorkspace();
  } else trigger?.focus({ preventScroll: true });
}

async function closeForNavigation() {
  navigating = true;
  open.value = false;
  await nextTick();
}

async function openCitation(destination: Route) {
  await closeForNavigation();
  if (!(await followCitation(destination, trigger))) trigger?.focus({ preventScroll: true });
}
</script>

<template>
  <template v-if="assistant">
    <UButton
      v-if="capability.enabled"
      :aria-label="text.copilot"
      :aria-expanded="open"
      icon="i-lucide-sparkles"
      color="neutral"
      variant="ghost"
      type="button"
      class="pe-copilot-trigger"
      @click="show($event.currentTarget as HTMLElement)"
    >
      <span class="pe:hidden pe:@min-[780px]:inline">{{ text.copilot }}</span>
    </UButton>
    <USlideover
      v-model:open="open"
      :title="catalog.integrations.copilot.heading"
      :content="sheetContent"
      :modal="narrow"
      :overlay="narrow"
      :dismissible="false"
      :close="{ variant: 'outline' }"
      side="right"
      :ui="{
        content: 'pe-copilot-sheet',
        overlay: 'pe-copilot-scrim',
        header: 'pe-copilot-sheet-header',
        close: 'pe-copilot-close',
        body: 'pe-copilot-sheet-body',
      }"
    >
      <template #title>
        <span ref="heading" class="pe-copilot-sheet-title" data-autofocus tabindex="-1">
          <UIcon name="i-lucide-sparkles" aria-hidden="true" />
          {{ catalog.integrations.copilot.heading }}
        </span>
      </template>
      <template #body>
        <component
          :is="assistant"
          v-if="open"
          :key="workspaceKey"
          :project="project"
          :review="review"
          @destination="openDestination"
          @citation="openCitation"
        />
      </template>
    </USlideover>
  </template>
</template>
