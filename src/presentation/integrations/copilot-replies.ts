import type { CopilotSource } from "../../application/integrations";
import type { CopilotThread } from "../../domain/integrations";

type Messages = CopilotThread["messages"];

export function completeReply(
  previous: Messages,
  prompt: string,
  content: string,
  sources: readonly string[],
): Messages {
  const messages: Messages = [
    ...previous,
    { role: "user", content: prompt },
    { role: "assistant", content, sources: [...new Set(sources)] },
  ];
  return messages.slice(-40);
}

export function replyCitations(messages: Messages, options: readonly CopilotSource[]) {
  return messages.map((message) => {
    const sources = message.role === "assistant" ? message.sources : undefined;
    return sources ? options.filter(({ key }) => sources.includes(key)) : [];
  });
}
