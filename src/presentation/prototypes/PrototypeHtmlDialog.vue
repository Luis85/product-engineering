<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { onScopeDispose, ref, shallowRef } from "vue";
import { importPrototypeHtml } from "../../application/prototypes";
import type { PrototypeRecord } from "../../application/prototypes";
import {
  PROTOTYPE_HTML_LIMIT,
  prototypeHtmlIssue,
  prototypeHtmlName,
} from "../../domain/prototypes";
import { leafModalUi } from "../projects";
import { ErrorNotice, useCommand, useMessages, useModal, useNavigationGuard } from "../shell";

const { base, replacing } = defineProps<{
  readonly base: PrototypeRecord;
  readonly replacing: boolean;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const text = useMessages().prototypes;
const output = text.output;
const saving = useCommand(importPrototypeHtml);
const { pending, message } = saving;
const open = ref(true);
const reading = ref(false);
const source = ref<HTMLTextAreaElement>();
const issue = ref<string>();
const file = shallowRef<{ readonly html: string; readonly name: string }>();
let revision = 0;
const modal = useModal(open, () => emit("dismiss"), close);
useNavigationGuard(() => !pending.value);
onScopeDispose(() => ++revision);

const normalized = (html: string) => html.replace(/\r\n?/g, "\n");

function originalFile(html: string) {
  const selected = file.value;
  return selected && normalized(selected.html) === html ? selected : undefined;
}

const form = useForm({
  defaultValues: { html: "" },
  async onSubmit({ value }) {
    if (pending.value || reading.value) return;
    const original = originalFile(value.html);
    const html = original?.html ?? value.html;
    const invalid = prototypeHtmlIssue(html);
    if (invalid) {
      issue.value = text.errors[invalid];
      source.value?.focus();
      return;
    }
    issue.value = undefined;
    if ((await saving.run(base, html, original?.name))._tag === "success") close();
  },
});

function changeSource(event: Event) {
  if (reading.value) ++revision;
  reading.value = false;
  issue.value = undefined;
  form.setFieldValue("html", (event.currentTarget as HTMLTextAreaElement).value);
}

async function readFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const selected = input.files?.item(0);
  if (!selected) return;
  input.value = "";
  const requested = ++revision;
  issue.value = undefined;
  reading.value = false;
  file.value = undefined;
  form.setFieldValue("html", "");
  if (selected.size > PROTOTYPE_HTML_LIMIT) {
    issue.value = text.errors.outputTooLarge;
    return;
  }
  if (!prototypeHtmlName(selected.name)) {
    issue.value = output.fileRead;
    return;
  }
  reading.value = true;
  try {
    const bytes = await selected.arrayBuffer();
    if (requested !== revision) return;
    const html = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    file.value = { html, name: selected.name };
    form.setFieldValue("html", normalized(html));
  } catch {
    if (requested === revision) issue.value = output.fileRead;
  } finally {
    if (requested === revision) reading.value = false;
  }
}

function close() {
  if (pending.value) return;
  ++revision;
  open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="output.import"
    :description="output.prompt"
    :content="modal"
    :dismissible="!pending"
    :close="false"
    :ui="{ ...leafModalUi, body: 'pe:min-w-0 pe:p-4' }"
    @update:open="close"
  >
    <template #body>
      <form
        class="pe-prototype-html-form"
        data-testid="prototype-import-form"
        @submit.prevent="form.handleSubmit"
      >
        <p v-if="replacing">{{ output.replace }}</p>
        <label>
          {{ output.file }}
          <input
            type="file"
            accept=".htm,.html,text/html"
            data-testid="prototype-html-file"
            :disabled="pending"
            @change="readFile"
          />
        </label>
        <form.Field v-slot="{ field }" name="html">
          <label>
            {{ output.source }}
            <textarea
              ref="source"
              data-autofocus
              data-testid="prototype-html-source"
              rows="7"
              spellcheck="false"
              :value="field.state.value"
              :readonly="pending"
              :aria-invalid="Boolean(issue)"
              @input="changeSource"
            />
          </label>
        </form.Field>
        <p class="pe:text-xs pe:text-muted">{{ file?.name ?? output.typeHint }}</p>
        <p v-if="issue" role="alert">{{ issue }}</p>
        <ErrorNotice v-else-if="message" :message="message" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.cancel"
            data-testid="prototype-html-cancel"
            :disabled="pending"
            @click="close"
          />
          <UButton
            type="submit"
            :label="output.import"
            data-testid="prototype-html-save"
            :loading="pending"
            :disabled="reading"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
