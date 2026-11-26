<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { computed, onScopeDispose, ref, shallowRef } from "vue";
import { confirmNfrImport, planNfrImport } from "../../../application/backlog";
import type { NfrImportPlan } from "../../../application/backlog";
import type { ProjectId } from "../../../application/projects";
import { nfrCsvHeaders } from "../../../domain/backlog";
import type { NfrCsvPreview } from "../../../domain/backlog";
import { leafModalUi } from "../../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
} from "../../shell";
import NfrImportPreview from "./NfrImportPreview.vue";

const { project } = defineProps<{ readonly project: ProjectId }>();
const emit = defineEmits<{ dismiss: []; imported: [number, number] }>();
const texts = useMessages().backlog;
const text = texts.nfr;
const open = ref(true);
const raw = ref("");
const plan = shallowRef<NfrImportPlan>();
const changed = shallowRef<NfrCsvPreview>();
const fileError = ref(false);
const fileReading = ref(false);
const previewing = useQuery(planNfrImport);
const saving = useCommand(confirmNfrImport);
const modal = useModal(open, () => emit("dismiss"), close);
const preview = computed(() => changed.value ?? plan.value?.preview);
const created = computed(
  () => preview.value?.rows.filter(({ status }) => status === "new").length ?? 0,
);
const skipped = computed(
  () => preview.value?.rows.filter(({ status }) => status === "skip").length ?? 0,
);
const canConfirm = computed(
  () =>
    plan.value &&
    !changed.value &&
    !plan.value.preview.issues.length &&
    created.value > 0 &&
    !saving.pending.value,
);
const failed = ref(false);
let rev = 0;
useNavigationGuard(() => !saving.pending.value);
onScopeDispose(() => {
  rev++;
});

function invalidate() {
  ++rev;
  plan.value = undefined;
  changed.value = undefined;
  failed.value = false;
  fileError.value = false;
  fileReading.value = false;
}

function replaceSource(value: string) {
  invalidate();
  raw.value = value;
}

async function readFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.item(0);
  if (!file) return;
  input.value = "";
  invalidate();
  fileReading.value = true;
  const requested = rev;
  try {
    const content = await file.text();
    if (requested === rev) replaceSource(content);
  } catch {
    if (requested === rev) fileError.value = true;
  } finally {
    if (requested === rev) fileReading.value = false;
  }
}

async function inspect() {
  if (fileReading.value || saving.pending.value) return;
  const requested = rev;
  const source = raw.value;
  const result = await previewing.run(project, source);
  if (requested === rev && result._tag === "success") {
    plan.value = result.value;
    changed.value = undefined;
    failed.value = false;
  }
}

async function confirm() {
  if (!canConfirm.value || !plan.value) return;
  failed.value = false;
  const result = await saving.run(project, raw.value, plan.value);
  if (result._tag === "failure") failed.value = true;
  if (result._tag !== "success") return;
  if (result.value.state === "changed") {
    changed.value = result.value.preview;
    return;
  }
  emit("imported", result.value.created, result.value.skipped);
  close();
}

function close() {
  if (saving.pending.value) return;
  invalidate();
  open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.import"
    :description="text.prompt"
    :content="modal"
    :close="false"
    :dismissible="!saving.pending.value"
    :ui="{ ...leafModalUi, content: leafModalUi.content + ' pe-nfr-modal' }"
    @update:open="close"
  >
    <template #body>
      <div class="pe-nfr-form">
        <p class="pe-nfr-csv-header">{{ nfrCsvHeaders.join(";") }}</p>
        <label>
          {{ text.file }}
          <input
            type="file"
            accept=".csv,text/csv"
            data-testid="nfr-csv-file"
            :disabled="saving.pending.value"
            @change="readFile"
          />
        </label>
        <label>
          {{ text.source }}
          <textarea
            data-autofocus
            data-testid="nfr-csv-source"
            rows="5"
            :value="raw"
            :disabled="saving.pending.value"
            @input="replaceSource(($event.currentTarget as HTMLTextAreaElement).value)"
          />
        </label>
        <p v-if="fileError" role="alert">{{ text.fileFailed }}</p>
        <ErrorNotice v-if="previewing.message.value" :message="previewing.message.value" />
        <p v-if="changed" role="status">{{ text.previewChanged }}</p>
        <NfrImportPreview v-if="preview" :preview="preview" :created="created" :skipped="skipped" />
        <template v-if="failed">
          <ErrorNotice v-if="saving.message.value" :message="saving.message.value" />
          <p role="status">{{ text.retry }}</p>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="pe-nfr-footer">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          data-testid="nfr-csv-cancel"
          :disabled="saving.pending.value"
          :label="texts.cancel"
          @click="close"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          data-testid="nfr-csv-preview"
          :loading="previewing.pending.value"
          :disabled="fileReading || saving.pending.value"
          :label="text.preview"
          @click="inspect"
        />
        <UButton
          v-if="preview"
          type="button"
          data-testid="nfr-csv-confirm"
          :label="text.confirm(created)"
          :disabled="!canConfirm"
          :loading="saving.pending.value"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
