import { Notice } from "obsidian";
import type { UserMessage } from "../../../application/shell";

export function showNotice(message: UserMessage): Notice {
  const content = activeDocument.createDocumentFragment();
  content.createEl("strong", { text: message.title });
  content.createDiv({ text: message.detail });
  if (message.link) {
    content.createEl("a", {
      text: message.link,
      attr: { href: message.link, target: "_blank", rel: "noopener" },
    });
  }
  return new Notice(content, message.severity === "error" ? 9_000 : 5_000);
}
