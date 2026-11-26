<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef } from "vue";
import { aiCapability } from "../../application/integrations";
import {
  prototypeBriefMarkdown,
  prototypeOutputKind,
  recordedPrototypeArtifact,
  resolvePrototypeBrief,
} from "../../application/prototypes";
import type { PrototypeRecord } from "../../application/prototypes";
import { ErrorNotice, useMessages, useQuery, useSettings } from "../shell";
import { downloadPrototypeFile } from "./download";
import { bundledPrototypeHtml } from "./legacy-case-controls";
import PrototypeGenerateAction from "./PrototypeGenerateAction.vue";
import PrototypeHtmlDialog from "./PrototypeHtmlDialog.vue";
import PrototypePreview from "./PrototypePreview.vue";

const { record } = defineProps<{ readonly record: PrototypeRecord }>();
const catalog = useMessages();
const settings = useSettings();
const capability = computed(() => aiCapability(settings.value));
const text = catalog.prototypes.brief;
const output = catalog.prototypes.output;
const query = useQuery(resolvePrototypeBrief);
const { pending, message } = query;
const importing = shallowRef<PrototypeRecord>();
let trigger: HTMLElement | undefined;
const legacyArtifact = {
  html: bundledPrototypeHtml,
  fileName: "PT-03-rev-2.html",
  provenance: "legacy" as const,
};
const legacy = computed(() => prototypeOutputKind(record) === "bundled");
const outputOrder = computed(() =>
  legacy.value ? ["preview", "actions"] : ["actions", "preview"],
);
const artifact = computed(() =>
  legacy.value ? legacyArtifact : recordedPrototypeArtifact(record),
);

async function exportBrief(event: MouseEvent) {
  const owner = (event.currentTarget as HTMLElement).ownerDocument;
  const result = await query.run(record);
  if (result._tag !== "success") return;
  const markdown = prototypeBriefMarkdown(
    result.value,
    text,
    (id) => catalog.backlog.nfr.category[id],
    catalog.shell.language,
  );
  downloadPrototypeFile(
    owner,
    text.fileName(result.value.displayId),
    "text/markdown;charset=utf-8",
    markdown,
  );
}

function exportHtml(event: MouseEvent) {
  const owner = (event.currentTarget as HTMLElement).ownerDocument;
  if (!artifact.value) return;
  downloadPrototypeFile(
    owner,
    artifact.value.fileName,
    "text/html;charset=utf-8",
    artifact.value.html,
  );
}

function openImport(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  importing.value = record;
}

function closeImport() {
  importing.value = undefined;
  trigger?.focus({ preventScroll: true });
}
</script>

<template>
  <template v-for="part in outputOrder" :key="part">
    <template v-if="part === 'actions'">
      <div class="pe:flex pe:flex-wrap pe:gap-2">
        <PrototypeGenerateAction
          v-if="capability.enabled"
          :record="record"
          :capability="capability"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          data-testid="prototype-export-brief"
          :label="text.action"
          :loading="pending"
          @click="exportBrief"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          data-testid="prototype-import-html"
          :label="output.import"
          @click="openImport"
        />
      </div>
      <ErrorNotice v-if="message" :message="message" />
    </template>
    <PrototypePreview
      v-else-if="artifact"
      :artifact="artifact"
      :title="record.title"
      :legacy="legacy"
      @download="exportHtml"
    />
  </template>
  <PrototypeHtmlDialog
    v-if="importing"
    :base="importing"
    :replacing="Boolean(artifact)"
    @dismiss="closeImport"
  />
</template>
