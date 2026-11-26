<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, watch } from "vue";
import type { BoardRequestHandoff } from "../../application/backlog";
import { featureRequestsRoute } from "../../application/feature-requests";
import type { FeatureRequest, FeatureRequestOrigin } from "../../application/feature-requests";
import type { ProjectId } from "../../application/projects";
import {
  useRememberWorkspaceOrigin,
  useRestoreWorkspacePosition,
  useWorkspaceOriginKey,
  useWorkspaceRouteFocus,
} from "../projects";
import { useMessages, useNavigate } from "../shell";

const {
  project,
  handoff,
  focusKey,
  from,
  resume = undefined,
} = defineProps<{
  readonly project: ProjectId;
  readonly handoff: BoardRequestHandoff<FeatureRequest>;
  readonly focusKey: string;
  readonly from: () => FeatureRequestOrigin;
  readonly resume?: string | undefined;
}>();
const text = useMessages()["feature-requests"];
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const focusRoute = useWorkspaceRouteFocus();
const origin = useWorkspaceOriginKey();
const expanded = ref(false);
const panel = ref<HTMLElement>();
let resumed: string | undefined;
const entries = computed(() =>
  handoff.previous.map((request) => ({
    request,
    key: focusKey + "-" + request.id,
  })),
);
const historical = (id: string | undefined) =>
  entries.value.find(({ request }) => request.id === id);

function resumeFocus(id: string) {
  const key = historical(id)?.key ?? (handoff.active?.id === id ? focusKey : undefined);
  const control = [
    ...(panel.value?.querySelectorAll<HTMLElement>("[data-pe-focus-key]") ?? []),
  ].find((element) => element.dataset.peFocusKey === key);
  if (!control?.isConnected) return;
  resumed = id;
  focusRoute(control);
}

watch(
  [entries, () => handoff.active, () => resume],
  async () => {
    const remembered = origin();
    const rememberedHistory = entries.value.some(({ key }) => key === remembered);
    if (historical(resume) || rememberedHistory) expanded.value = true;
    await nextTick();
    if (!remembered && resume && resume !== resumed) resumeFocus(resume);
    else if (remembered === focusKey || rememberedHistory) restore();
  },
  { immediate: true, flush: "post" },
);

async function open(record: FeatureRequest, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(featureRequestsRoute(project, { requestId: record.id, origin: from() }))))
    remember(undefined);
}
</script>

<template>
  <div
    v-if="handoff.active || entries.length"
    ref="panel"
    class="pe-request-links"
    data-testid="pbi-request-links"
  >
    <div v-if="handoff.active" class="pe-request-link">
      <UButton
        type="button"
        variant="link"
        class="pe:p-0 pe:text-start pe:wrap-anywhere"
        :data-request-link="handoff.active.displayId"
        :data-pe-focus-key="focusKey"
        @click="open(handoff.active, $event)"
        >{{ handoff.active.displayId }} · {{ handoff.active.title }}</UButton
      >
      <span class="pe-request-state">{{ text.states[handoff.active.state] }}</span>
    </div>
    <details v-if="entries.length" :open="expanded">
      <summary class="pe:cursor-pointer" @click.prevent="expanded = !expanded">
        {{ text.previous }} · {{ entries.length }}
      </summary>
      <div v-for="{ request, key } in entries" :key="key" class="pe-request-link">
        <UButton
          type="button"
          variant="link"
          class="pe:p-0 pe:text-start pe:wrap-anywhere"
          :data-request-link="request.displayId"
          :data-pe-focus-key="key"
          @click="open(request, $event)"
          >{{ request.displayId }} · {{ request.title }}</UButton
        >
        <span class="pe-request-state">{{ text.states[request.state] }}</span>
      </div>
    </details>
  </div>
</template>
