<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, useId } from "vue";
import { markdownWebTarget } from "../../domain/knowledge";
import { leafModalUi } from "../projects";
import { useMarkdownHost, useMessages, useModal } from "../shell";
import type { VaultFile, VaultLink } from "../shell";
import KnowledgeSelect from "./KnowledgeSelect.vue";

const { mode, selection, afterClose, source } = defineProps<{
  readonly mode: "link" | "image" | "reference" | "web";
  readonly selection: string;
  readonly afterClose: () => void;
  readonly source: string;
}>();
const emit = defineEmits<{ pick: [link: VaultLink]; insert: [target: string] }>();
const catalog = useMessages().knowledge;
const text = catalog.note;
const web = mode === "web";
const host = useMarkdownHost();
const open = ref(true);
const modal = useModal(open, afterClose);
const invalid = ref(false);
const errorId = useId();
const errorDescription = computed(() => (invalid.value ? errorId : undefined));
const form = useForm({
  defaultValues: { query: "" },
  onSubmit({ value }) {
    if (!web) return confirmFile();
    const target = markdownWebTarget(value.query);
    invalid.value = target === undefined;
    if (!target) return;
    emit("insert", target);
    open.value = false;
  },
});
const query = form.useStore((state) => state.values.query);
const field = web
  ? ({ name: "url", type: "url", "aria-label": "URL", placeholder: "https://" } as const)
  : ({ type: "search", "aria-label": text.findFile, placeholder: text.findFile } as const);
const title = web ? text.insertWebLink : text.pickFile;
const cancel = web ? catalog.cancel : text.keep;
const confirmLabel = web ? text.insertWebLink : text.selectFile;
const vaultPanel = web ? undefined : "knowledge-vault-picker";
const vaultConfirm = web ? undefined : "knowledge-vault-confirm";
const file = ref<VaultFile>();
const alias = ref(selection.trim().replace(/[\r\n]+/g, " "));
const heading = ref("");
const files = web
  ? []
  : host
      .files()
      .filter(({ path, kind }) => path !== source && (mode !== "image" || kind === "image"));
const matches = computed(() => {
  const term = query.value.trim().toLowerCase();
  return files
    .filter(({ path }) => path.toLowerCase().includes(term))
    .toSorted((a, b) => a.path.localeCompare(b.path));
});
const unsupported = computed(() => file.value?.kind === "unsupported");
const showDetails = computed(() => file.value !== undefined && mode !== "image");
const headingChoices = computed(() =>
  (file.value?.headings ?? []).map((label) => ({ value: "#" + label, label })),
);
const canConfirm = computed(() => web || (file.value !== undefined && !unsupported.value));

function change(value: string | number) {
  invalid.value = false;
  form.setFieldValue("query", String(value));
}

function selected(path: string) {
  return file.value?.path === path;
}

function color(path: string) {
  return selected(path) ? "primary" : "neutral";
}

function choose(picked: VaultFile) {
  file.value = picked;
  heading.value = "";
}

function confirmFile() {
  const picked = file.value;
  if (!picked || picked.kind === "unsupported") return;
  emit("pick", {
    path: picked.path,
    heading: heading.value,
    alias: alias.value.trim(),
    embed: mode === "image",
  });
  open.value = false;
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :content="modal" :ui="leafModalUi">
    <template #body>
      <form
        class="pe:grid pe:min-w-0 pe:gap-3"
        :data-testid="vaultPanel"
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <UInput
          v-bind="field"
          :model-value="query"
          :aria-invalid="invalid"
          :aria-describedby="errorDescription"
          data-autofocus
          @update:model-value="change"
        />
        <p v-if="invalid" :id="errorId" role="alert">{{ text.invalidWebLink }}</p>
        <template v-if="!web">
          <ul v-if="matches.length" class="pe-note-vault-list">
            <li v-for="entry in matches" :key="entry.path">
              <UButton
                type="button"
                :color="color(entry.path)"
                variant="soft"
                :aria-pressed="selected(entry.path)"
                :data-vault-file="entry.path"
                class="pe-note-vault-path"
                @click="choose(entry)"
                >{{ entry.path }}</UButton
              >
            </li>
          </ul>
          <p v-else>{{ text.noFiles }}</p>
          <p v-if="unsupported" role="status">{{ text.unsupported }}</p>
          <template v-else-if="showDetails">
            <KnowledgeSelect
              v-if="headingChoices.length"
              v-model="heading"
              name="vault-heading"
              :label="text.heading"
              :empty="text.wholeFile"
              :disabled="false"
              :options="headingChoices"
            />
            <label class="pe:grid pe:gap-1 pe:text-sm">
              {{ text.alias }}
              <UInput v-model="alias" name="vault-alias" />
            </label>
          </template>
        </template>
        <div class="pe-note-actions">
          <UButton type="button" variant="soft" @click="open = false" :label="cancel" />
          <UButton
            type="submit"
            :data-testid="vaultConfirm"
            :disabled="!canConfirm"
            :label="confirmLabel"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
