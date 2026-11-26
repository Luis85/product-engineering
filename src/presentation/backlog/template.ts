import { defineComponent, h } from "vue";
import { backlogChanges } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import type { ProjectTemplateRequest } from "../projects";
import { useAsyncStream, useMessages } from "../shell";
import BacklogEditor from "./BacklogEditor.vue";

export function backlogTemplate({ projectId, dismiss }: ProjectTemplateRequest) {
  return defineComponent({
    name: "BacklogTemplate",
    setup() {
      const text = useMessages().backlog;
      const snapshot = useAsyncStream<BacklogSnapshot, never>(
        { ready: false, items: [], duplicates: [] },
        backlogChanges(projectId),
      );
      return () => {
        const { base, items, issue } = snapshot.value;
        if (base)
          return h(BacklogEditor, {
            project: projectId,
            base,
            items,
            kind: "UC",
            onDismiss: dismiss,
          });
        if (!issue) return h("p", { role: "status" }, text.waiting);
        return h("div", [
          h("p", { role: "alert" }, text.errors[issue]),
          h("button", { type: "button", onClick: dismiss }, text.close),
        ]);
      };
    },
  });
}
