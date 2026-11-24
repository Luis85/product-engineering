<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref, shallowRef, watch } from "vue";
import type { PrototypeRecord, PrototypeSourceOption } from "../../application/prototypes";
import {
  inspectPrototypeBrief,
  prototypeInputChanges,
  prototypeOutputKind,
  prototypesRoute,
} from "../../application/prototypes";
import {
  useAsyncStream,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
} from "../shell";
import PrototypeBriefDialog from "./PrototypeBriefDialog.vue";
import PrototypeBriefContext from "./PrototypeBriefContext.vue";
import PrototypeDesignLinks from "./PrototypeDesignLinks.vue";
import PrototypeScopeLink from "./PrototypeScopeLink.vue";
import PrototypeStatus from "./PrototypeStatus.vue";

const { record, scope } = defineProps<{
  readonly record: PrototypeRecord;
  readonly scope: PrototypeSourceOption | undefined;
}>();
const text = useMessages().prototypes;
const navigate = useNavigate();
const { definition, history } = useRouting();
const { back } = useHistory();
const changes = useAsyncStream({}, prototypeInputChanges);
const inspection = useQuery(inspectPrototypeBrief);
const inspected = shallowRef<typeof inspection.value.value>();
// Keep the rendered links in place until the refresh has a settled result.
watch([inspection.pending, inspection.value], ([pending, value]) => {
  if (!pending) inspected.value = value;
});
watch([() => record, changes], () => void inspection.run(record), { immediate: true });
const editing = ref<PrototypeRecord>();
const bundled = computed(() => prototypeOutputKind(record) === "bundled");
const briefPlacement = computed(() => {
  const brief = inspected.value?.brief;
  return bundled.value ? { after: brief, before: undefined } : { before: brief, after: undefined };
});
let trigger: HTMLElement | undefined;

function edit(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  editing.value = record;
}

function close() {
  editing.value = undefined;
  trigger?.focus({ preventScroll: true });
}

function goBack() {
  const route = prototypesRoute(record.projectId);
  const previous = history.value.back.at(-1);
  return previous && definition.equals(previous, route) ? back() : navigate(route);
}
</script>

<template>
  <article
    class="pe-prototypes"
    :data-prototype-id="record.displayId"
    data-testid="prototype-detail"
  >
    <UButton
      type="button"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      class="pe:justify-self-start pe:p-0"
      :label="text.back"
      @click="goBack"
    />
    <header class="pe-prototype-header">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <p class="pe:text-sm pe:text-muted">
          {{ text.revision(record.displayId, record.revision) }}
        </p>
        <h1 tabindex="-1" class="pe-prototype-heading">{{ record.title }}</h1>
      </div>
      <UButton
        type="button"
        variant="soft"
        color="neutral"
        :label="text.edit"
        data-testid="prototype-edit"
        @click="edit"
      />
    </header>
    <dl class="pe-prototype-brief" :class="{ 'pe-prototype-legacy-brief': bundled }">
      <div>
        <dt>{{ text.scope }}</dt>
        <dd><PrototypeScopeLink :record="record" :scope="scope" /></dd>
      </div>
      <div>
        <dt>{{ text.status }}</dt>
        <dd><PrototypeStatus :record="record" detail :fingerprint="inspected?.fingerprint" /></dd>
      </div>
      <div v-if="!bundled" class="pe-prototype-description">
        <dt>{{ text.description }}</dt>
        <dd>{{ record.description || text.noDescription }}</dd>
      </div>
      <PrototypeDesignLinks :record="record" />
    </dl>
    <PrototypeBriefContext
      v-if="briefPlacement.before"
      :brief="briefPlacement.before"
      :prototype-id="record.id"
    />
    <slot name="output" :record="record" :scope="scope" />
    <dl v-if="bundled && record.description" class="pe-prototype-brief pe-prototype-description">
      <dt>{{ text.description }}</dt>
      <dd>{{ record.description }}</dd>
    </dl>
    <PrototypeBriefContext
      v-if="briefPlacement.after"
      :brief="briefPlacement.after"
      :prototype-id="record.id"
    />
    <PrototypeBriefDialog
      v-if="editing"
      :project-id="record.projectId"
      :base="editing"
      @dismiss="close"
    />
  </article>
</template>
