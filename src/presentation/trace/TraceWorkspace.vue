<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, onMounted, watch } from "vue";
import { backlogChanges, backlogRoute } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { readTrace, traceChanges, tracePbiOptions, traceRoute } from "../../application/trace";
import type { TraceRoute } from "../../application/trace";
import { useRestoreWorkspacePosition } from "../projects";
import { useAsyncStream, useMessages, useQuery, useRouting } from "../shell";
import TraceDeliveryChain from "./TraceDeliveryChain.vue";
import TraceEvidence from "./TraceEvidence.vue";
import TraceLink from "./TraceLink.vue";
import TraceSource from "./TraceSource.vue";

const { route } = defineProps<{ readonly route: TraceRoute }>();
const project = route.projectId;
const text = useMessages().trace;
const { navigation } = useRouting();
const backlog = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
const options = computed(() => tracePbiOptions(backlog.value.items));
const selected = computed(
  () => options.value.find(({ key }) => key === route.pbi) ?? options.value[0],
);
const selection = computed({
  get: () => selected.value?.key,
  set: (key) => {
    void navigation.replace(traceRoute(project, key));
  },
});
const changes = useAsyncStream<symbol | undefined, never>(undefined, traceChanges(project));
const query = useQuery(readTrace);
const trace = computed(() => {
  const value = query.value.value;
  return value?.projectId === project && value.key === selected.value?.key ? value : undefined;
});
const firstGap = computed(() => trace.value?.source.gaps[0]);
const status = computed(() => {
  if (backlog.value.issue || query.message.value) return text.unavailable;
  if (!backlog.value.ready || (selected.value && !trace.value)) return text.loading;
  return selected.value ? undefined : text.empty;
});
watch(
  [selected, changes],
  ([item]) => {
    if (item) void query.run(project, item.key);
  },
  { immediate: true },
);
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch(trace, () => restore("available"), { flush: "post" });
</script>

<template>
  <article class="pe-trace" data-testid="trace-workspace">
    <header>
      <h1 tabindex="-1">{{ text.title }}</h1>
      <p>{{ text.intro }}</p>
    </header>
    <label v-if="selected" class="pe-trace-selector">
      <span>{{ text.pbi }}</span>
      <span class="pe-trace-select-control">
        <select v-model="selection" data-testid="trace-pbi" data-pe-focus-key="trace-pbi">
          <option v-for="item in options" :key="item.key" :value="item.key">
            {{ item.id ? `${item.id} · ${item.title}` : item.title }}
          </option>
        </select>
        <UIcon name="i-lucide-chevron-down" class="pe-trace-select-chevron" aria-hidden="true" />
      </span>
    </label>
    <div v-if="status" class="pe-trace-notice" role="status">
      <span>{{ status }}</span>
      <TraceLink
        v-if="status === text.empty"
        :destination="backlogRoute(project)"
        data-pe-focus-key="trace-empty-backlog"
        data-testid="trace-empty-backlog"
        >{{ text.openBacklog }}</TraceLink
      >
    </div>
    <template v-if="trace">
      <div v-if="firstGap" class="pe-trace-notice pe-trace-warning" data-testid="trace-gap">
        <p>{{ text.gaps[firstGap] }}</p>
        <TraceLink
          :destination="trace.source.pbiRoute"
          data-pe-focus-key="trace-gap-pbi"
          data-testid="trace-gap-pbi"
          >{{ text.openPbi }}</TraceLink
        >
      </div>
      <section class="pe-trace-artifacts">
        <h2>{{ text.artifacts }}</h2>
        <div class="pe-trace-columns">
          <TraceSource :source="trace.source" />
          <TraceDeliveryChain :delivery="trace.delivery" />
        </div>
      </section>
      <TraceEvidence :trace="trace" />
    </template>
  </article>
</template>
