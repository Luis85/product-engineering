<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref } from "vue";
import { useMarkdownHost, useMessages } from "../shell";
import type { VaultLink } from "../shell";
import KnowledgeLinkPicker from "./KnowledgeLinkPicker.vue";
import KnowledgeMarkdown from "./KnowledgeMarkdown.vue";

const { path, saving } = defineProps<{ readonly path: string; readonly saving: boolean }>();
const markdown = defineModel<string>({ required: true });
const text = useMessages().knowledge.note;
const host = useMarkdownHost();
const editor = ref<HTMLTextAreaElement>();
const preview = ref(false);
const picker = ref<"link" | "image" | "web">();
const selection = ref("");
let range = { start: 0, end: 0 };
let insertion: string | undefined;
const toolbarDisabled = computed(() => saving || preview.value);
const previewLabel = computed(() => (preview.value ? text.editSource : text.preview));
const marker = { paragraph: "", heading: "## ", bullets: "- ", quote: "> " };
const blockStyles = ["paragraph", "heading", "bullets", "numbered", "quote"] as const;
const tools = [
  { id: "format-bold", label: text.bold, color: "neutral", run: () => format("**") },
  { id: "format-italic", label: text.italic, color: "neutral", run: () => format("*") },
  { id: "insert-web-link", label: text.webLink, color: "neutral", run: () => openPicker("web") },
  { id: "insert-link", label: text.insertLink, color: "primary", run: () => openPicker("link") },
  { id: "insert-image", label: text.insertImage, color: "primary", run: () => openPicker("image") },
] as const;

async function focus() {
  preview.value = false;
  await nextTick();
  editor.value?.focus({ preventScroll: true });
}
defineExpose({ focus });

function replace(control: HTMLTextAreaElement, start: number, end: number, value: string) {
  control.setRangeText(value, start, end);
  markdown.value = control.value;
  return start + value.length;
}

function format(mark: string) {
  const control = editor.value;
  if (!control) return;
  const { selectionStart: start, selectionEnd: end } = control;
  replace(control, start, end, mark + control.value.slice(start, end) + mark);
  control.setSelectionRange(start + mark.length, end + mark.length);
  control.focus({ preventScroll: true });
}

function formatBlock(event: Event) {
  const pickerControl = event.currentTarget as HTMLSelectElement;
  const style = blockStyles.find((option) => option === pickerControl.value);
  pickerControl.value = "";
  const control = editor.value;
  if (!control || !style) return;
  const { value, selectionStart: start, selectionEnd: end } = control;
  const from = value.slice(0, start).lastIndexOf("\n") + 1;
  const boundary = value.indexOf("\n", Math.max(start, end - 1));
  const to = boundary < 0 ? value.length : boundary;
  const lines = value.slice(from, to).split("\n");
  let number = 0;
  const formatted = lines.map((line) => {
    if (!line.trim() && lines.length > 1) return line;
    const [prefix, indent = ""] = /^([ \t]*)(?:(?:#{1,6}|[-+*]|\d+[.)]|>)[ \t]+)?/.exec(line) ?? [
      "",
    ];
    const next = style === "numbered" ? ++number + ". " : marker[style];
    return indent + next + line.slice(prefix.length);
  });
  const newEnd = replace(control, from, to, formatted.join("\n"));
  control.setSelectionRange(start === end ? newEnd : from, newEnd);
  control.focus({ preventScroll: true });
}

async function togglePreview() {
  if (preview.value) await focus();
  else preview.value = true;
}

function openPicker(mode: NonNullable<typeof picker.value>) {
  const control = editor.value;
  if (!control) return;
  range = { start: control.selectionStart, end: control.selectionEnd };
  selection.value = control.value.slice(range.start, range.end);
  picker.value = mode;
}

function insert(link: VaultLink) {
  insertion = host.makeLink(link, path);
}

function insertWebLink(target: string) {
  const label = (selection.value || target).replace(/[\\[\]]/g, "\\$&").replaceAll("\n", " ");
  insertion = "[" + label + "](" + target + ")";
}

function closePicker() {
  picker.value = undefined;
  const control = editor.value;
  if (!control) return;
  if (insertion !== undefined) {
    const end = replace(control, range.start, range.end, insertion);
    range = { start: end, end };
    insertion = undefined;
  }
  control.focus({ preventScroll: true });
  control.setSelectionRange(range.start, range.end);
}
</script>

<template>
  <div class="pe-note-actions">
    <select
      name="block-format"
      :aria-label="text.blockFormat"
      :disabled="toolbarDisabled"
      class="pe:max-w-full"
      @change="formatBlock"
    >
      <option value="">{{ text.blockFormat }}</option>
      <option v-for="style in blockStyles" :key="style" :value="style">{{ text[style] }}</option>
    </select>
    <UButton
      v-for="{ id, label, color, run } in tools"
      :key="id"
      type="button"
      variant="soft"
      :color="color"
      :disabled="toolbarDisabled"
      :data-testid="'knowledge-' + id"
      @click="run"
      :label="label"
    />
    <UButton
      type="button"
      variant="ghost"
      :aria-pressed="preview"
      data-testid="knowledge-preview"
      @click="togglePreview"
      :label="previewLabel"
    />
  </div>
  <textarea
    v-show="!preview"
    ref="editor"
    v-model="markdown"
    name="markdown"
    :aria-label="text.markdown"
    :readonly="saving"
    class="pe-note-editor"
  />
  <KnowledgeMarkdown v-if="preview" :body="markdown" :path="path" />
  <KnowledgeLinkPicker
    v-if="picker"
    :mode="picker"
    :selection="selection"
    :source="path"
    :after-close="closePicker"
    @pick="insert"
    @insert="insertWebLink"
  />
</template>
