import { defineComponent, h } from "vue";
import { isKnowledgeKind } from "../../application/knowledge";
import type { ProjectTemplateRequest } from "../projects";
import KnowledgeCreateDialog from "./KnowledgeCreateDialog.vue";

export function createFromProjectTemplate(request: ProjectTemplateRequest) {
  const { projectId, template, dismiss } = request;
  if (!isKnowledgeKind(template)) throw new Error("The Knowledge template is unavailable");
  return defineComponent({
    name: "KnowledgeTemplateDialog",
    setup: () => () =>
      h(KnowledgeCreateDialog, {
        projectId,
        initialTemplate: template,
        onDismiss: dismiss,
      }),
  });
}
