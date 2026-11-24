<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref } from "vue";
import { useMarkdownHost, useMessages } from "../shell";
import type { VaultLink } from "../shell";
import KnowledgeVaultLinks from "./KnowledgeVaultLinks.vue";
import KnowledgeLinkPicker from "./KnowledgeLinkPicker.vue";

const {
  source,
  references,
  editable,
  explicitOnly = false,
} = defineProps<{
  readonly source: string;
  readonly references: readonly string[];
  readonly editable: boolean;
  readonly explicitOnly?: boolean;
}>();
const emit = defineEmits<{ change: [references: readonly string[]] }>();
const host = useMarkdownHost();
const text = useMessages().knowledge.note;
const pickerOpen = ref(false);
const trigger = ref<{ $el: HTMLElement }>();
const links = computed(() => host.noteLinks(source));
const status = ref("");
const explicit = computed(() => references.map((link) => ({ link, label: link, original: link })));
const inbound = computed(() =>
  links.value.inbound.map((link) => ({ link, label: link, original: link })),
);

function add(link: VaultLink) {
  if (references.some((reference) => host.resolve(reference, source)?.path === link.path)) {
    status.value = text.duplicateReference;
    return;
  }
  const alias = link.alias ? "|" + link.alias.replace(/[[\]|]/g, "") : "";
  emit("change", [...references, "[[" + link.path + link.heading + alias + "]]"]);
  status.value = "";
}

function remove(index: number) {
  emit(
    "change",
    references.filter((_, position) => position !== index),
  );
}

function closePicker() {
  pickerOpen.value = false;
  trigger.value?.$el.focus({ preventScroll: true });
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-5">
    <section class="pe:grid pe:gap-2" data-testid="knowledge-explicit-references">
      <div class="pe-note-section-head">
        <h2 class="pe:text-base pe:font-semibold">{{ text.explicitReferences }}</h2>
        <UButton
          v-if="editable"
          ref="trigger"
          type="button"
          variant="soft"
          data-testid="knowledge-add-reference"
          @click="pickerOpen = true"
          :label="text.addReference"
        />
      </div>
      <p v-if="status" role="status">{{ status }}</p>
      <KnowledgeVaultLinks
        :source="source"
        :links="explicit"
        :editable="editable"
        @remove="remove"
      />
    </section>
    <section v-if="!explicitOnly" class="pe:grid pe:gap-2" data-testid="knowledge-inline-links">
      <h2 class="pe:text-base pe:font-semibold">{{ text.inlineLinks }}</h2>
      <KnowledgeVaultLinks :source="source" :links="links.inline" />
    </section>
    <section v-if="!explicitOnly" class="pe:grid pe:gap-2" data-testid="knowledge-vault-backlinks">
      <h2 class="pe:text-base pe:font-semibold">{{ text.vaultBacklinks }}</h2>
      <KnowledgeVaultLinks :source="source" :links="inbound" />
    </section>
    <KnowledgeLinkPicker
      v-if="pickerOpen"
      mode="reference"
      selection=""
      :source="source"
      :after-close="closePicker"
      @pick="add"
    />
  </div>
</template>
