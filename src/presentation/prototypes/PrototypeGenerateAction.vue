<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, useId, watch } from "vue";
import { sameAiCapability } from "../../application/integrations";
import type { aiCapability } from "../../application/integrations";
import {
  PROJECT_PROTOTYPES,
  dispatchPrototypeGeneration,
  preparePrototypeGeneration,
} from "../../application/prototypes";
import type { PrototypeGenerationDestination, PrototypeRecord } from "../../application/prototypes";
import { leafModalUi } from "../projects";
import { ErrorNotice, useMessages, useModal, useQuery, useRouting } from "../shell";
import PrototypeGenerationDisclosure from "./PrototypeGenerationDisclosure.vue";

const { record, capability } = defineProps<{
  readonly record: PrototypeRecord;
  readonly capability: ReturnType<typeof aiCapability>;
}>();
const catalog = useMessages();
const text = catalog.prototypes.generation;
const { navigation } = useRouting();
const action = computed(() => (capability.mode === "demo" ? text.simulate : text.action));
const formId = useId();
const open = ref(false);
const preparation = useQuery(preparePrototypeGeneration);
const generation = useQuery(dispatchPrototypeGeneration);
const { pending, error, message } = generation;
const { pending: reviewing, value: prepared } = preparation;
const reason = computed(() =>
  error.value?._tag === "PrototypeError" ? error.value.reason : undefined,
);
const stale = computed(() => reason.value === "outputChanged");
const attempted = ref(false);
const defect = ref(false);
const canRun = computed(() => open.value && !pending.value && (!attempted.value || !stale.value));
const reviewNeeded = computed(
  () => !pending.value && !reviewing.value && ((attempted.value && stale.value) || !prepared.value),
);
const readyNotice = computed(() =>
  prepared.value ? (attempted.value ? message.value : undefined) : preparation.message.value,
);
const status = computed(() => {
  if (pending.value)
    return { role: "status", label: text.running, testId: "prototype-generation-running" };
  if (reviewing.value) return { role: "status", label: catalog.prototypes.loading };
  if (!attempted.value) return undefined;
  if (reason.value === "outputInvalid") return { role: "alert", label: text.invalid };
  if (reason.value === "generationCancelled")
    return { role: "status", label: catalog.prototypes.errors.generationCancelled };
  return defect.value
    ? { role: "alert", label: catalog.prototypes.errors.generationFailed }
    : undefined;
});
let trigger: HTMLElement | undefined;
let controller: AbortController | undefined;

function close() {
  controller?.abort();
  controller = undefined;
  open.value = false;
}

const modal = useModal(open, () => trigger?.focus({ preventScroll: true }), close);
onScopeDispose(close);
watch(
  () => capability,
  (value, old) => {
    if (!sameAiCapability(value, old)) close();
  },
  { flush: "sync" },
);

function review(event?: MouseEvent) {
  if (event) trigger = event.currentTarget as HTMLElement;
  const mode = capability.mode;
  const label = catalog.integrations.settings.ai.modes[mode];
  const destination: PrototypeGenerationDestination =
    mode === "demo" ? { kind: "simulation", label } : { kind: "provider", provider: mode, label };
  attempted.value = false;
  defect.value = false;
  open.value = true;
  void preparation.run(
    record,
    destination,
    catalog.shell.language,
    (id) => catalog.backlog.nfr.category[id],
  );
}

function activeTarget() {
  const route = navigation.current();
  if (open.value && route.name === PROJECT_PROTOTYPES && route.prototypeId) {
    return { projectId: route.projectId, prototypeId: route.prototypeId };
  }
}

function cancel() {
  if (pending.value) controller?.abort();
  else close();
}

const form = useForm({
  defaultValues: {},
  async onSubmit() {
    const reviewed = prepared.value;
    if (!reviewed || !canRun.value) return;
    const request = new AbortController();
    controller = request;
    attempted.value = true;
    defect.value = false;
    try {
      const result = await generation.run(
        reviewed,
        {
          signal: request.signal,
          active: activeTarget,
          replace: reviewed.replaceRequired,
        },
        capability,
      );
      if (controller !== request) return;
      if (result._tag === "success") close();
      if (result._tag === "defect") defect.value = true;
    } finally {
      if (controller === request) controller = undefined;
    }
  },
});

const submitLabel = computed(() => {
  if (prepared.value?.replaceRequired) return text.replaceAction;
  return attempted.value && (message.value || defect.value) ? text.retry : text.start;
});
</script>

<template>
  <UButton type="button" :label="action" data-testid="prototype-generate-html" @click="review" />
  <UModal
    :open="open"
    :title="action"
    :description="text.description"
    :content="modal"
    :close="false"
    :ui="{
      ...leafModalUi,
      body: 'pe:min-w-0 pe:p-4',
      footer: 'pe:flex-wrap pe:justify-end pe:gap-2',
    }"
    @update:open="close"
  >
    <template #body>
      <form
        :id="formId"
        class="pe-prototype-html-form"
        data-testid="prototype-generation-form"
        @submit.prevent="form.handleSubmit"
      >
        <PrototypeGenerationDisclosure
          v-if="prepared"
          :target="prepared.base"
          :scope="prepared.scope"
          :request="prepared.disclosure"
          :replacing="prepared.replaceRequired"
        />
        <p v-if="status" :role="status.role" :data-testid="status.testId">{{ status.label }}</p>
        <ErrorNotice v-else-if="readyNotice" :message="readyNotice" />
      </form>
    </template>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :label="catalog.prototypes.cancel"
        data-autofocus
        data-testid="prototype-generation-cancel"
        @click="cancel"
      />
      <UButton
        v-if="reviewNeeded"
        type="button"
        :label="text.reviewAgain"
        data-testid="prototype-generation-review-again"
        @click="review"
      />
      <UButton
        v-else-if="prepared"
        :form="formId"
        type="submit"
        :label="submitLabel"
        :disabled="pending"
        data-testid="prototype-generation-start"
      />
    </template>
  </UModal>
</template>
