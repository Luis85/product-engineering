import type { Component } from "vue";
import KnowledgeScreen from "./KnowledgeScreen.vue";

export const knowledgeScreen: Component = KnowledgeScreen;
export { knowledgeSearchSource } from "./search";
export { createFromProjectTemplate } from "./template-factory";
export { default as KnowledgeLeaveDialog } from "./KnowledgeLeaveDialog.vue";
export { default as KnowledgeMarkdown } from "./KnowledgeMarkdown.vue";
export { default as KnowledgeNoteEditor } from "./KnowledgeNoteEditor.vue";
