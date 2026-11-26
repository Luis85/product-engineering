import { defineComponent, h } from "vue";
import { isKnowledgeKind } from "../../application/knowledge";
import type { Note } from "../../application/notes";
import type { ProjectTemplateRequest } from "../projects";
import KnowledgeCreateDialog from "./KnowledgeCreateDialog.vue";
import { useKnowledgeDraftNavigation } from "./draft-navigation";

export function createFromProjectTemplate(request: ProjectTemplateRequest) {
  const { projectId, template, dismiss, trigger } = request;
  if (!isKnowledgeKind(template)) throw new Error("The Knowledge template is unavailable");
  return defineComponent({
    name: "KnowledgeTemplateDialog",
    setup() {
      const { openDraft } = useKnowledgeDraftNavigation();
      async function created(note: Note) {
        await openDraft(
          note,
          projectId,
          { section: "templates", reference: { kind: "template", recordId: template } },
          trigger,
        );
      }
      return () =>
        h(KnowledgeCreateDialog, {
          projectId,
          initialTemplate: template,
          onDismiss: dismiss,
          onCreated: created,
        });
    },
  });
}
