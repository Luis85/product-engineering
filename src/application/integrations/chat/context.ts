import { Effect } from "effect";
import type { CopilotDraftKind, CopilotMode } from "../../../domain/integrations";
import type { ProjectId } from "../../projects";
import { ProviderChatError } from "./index";
import type { ChatMessage, ChatRequest } from "./index";
import { copilotSources, readCopilotSource } from "./sources";
import type { CopilotSource } from "./sources";

type ContextRequest = {
  readonly projectId: ProjectId;
  readonly provider: ChatRequest["provider"];
  readonly prompt: string;
  readonly mode: CopilotMode;
  readonly proposal?: { readonly kind: CopilotDraftKind; readonly target?: string };
  readonly reviewTarget?: string;
  readonly selected: readonly string[];
  readonly history: readonly ChatMessage[];
  readonly instructions: string;
};

export function scopedChatMessages(request: ContextRequest) {
  return Effect.gen(function* () {
    const { projectId, provider, mode, history } = request;
    const keys = [...new Set(request.selected)];
    if (keys.length > 12 || textTooLong(request))
      return yield* new ProviderChatError({ provider, reason: "unsupported-request" });
    const options = yield* copilotSources(projectId);
    const target = yield* checkedTarget(request, options, keys);
    const sources = yield* Effect.forEach(keys, (key) =>
      Effect.gen(function* () {
        const unavailable = new ProviderChatError({
          provider,
          reason: key === target?.key ? "target-unavailable" : "source-unavailable",
        });
        const source = options.find((option) => option.key === key);
        if (!source) return yield* unavailable;
        const body = yield* readCopilotSource(projectId, source).pipe(
          Effect.mapError(() => unavailable),
        );
        if (body === undefined) return yield* unavailable;
        return { name: source.displayId, title: source.title, body: body.slice(0, 8_000) };
      }),
    );
    const content = JSON.stringify({
      mode,
      prompt: request.prompt,
      instructions: request.instructions,
      sources,
      reviewTarget: mode === "review" ? target?.displayId : undefined,
      ...proposalFields(request, target),
    });
    const prior = history.slice(-12).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 8_000),
    }));
    return [...prior, { role: "user", content }] as const;
  });
}

function checkedTarget(
  request: ContextRequest,
  options: readonly CopilotSource[],
  keys: readonly string[],
) {
  const { mode, provider, proposal, reviewTarget } = request;
  const key = mode === "review" ? reviewTarget : mode === "revise" ? proposal?.target : undefined;
  const target = selectedOption(options, keys, key);
  const missingReview = mode === "review" && !target;
  const missingRevision = mode === "revise" && target?.kind !== "knowledge";
  return missingReview || missingRevision
    ? Effect.fail(new ProviderChatError({ provider, reason: "target-unavailable" }))
    : Effect.succeed(target);
}

function textTooLong({ prompt, instructions }: ContextRequest) {
  return prompt.length > 8_000 || instructions.length > 8_000;
}

function selectedOption(options: readonly CopilotSource[], keys: readonly string[], key?: string) {
  return key && keys.includes(key) ? options.find((option) => option.key === key) : undefined;
}

function proposalFields(request: ContextRequest, target: CopilotSource | undefined) {
  const { proposal, mode } = request;
  if (!proposal) return;
  return {
    proposal: {
      kind: proposal.kind,
      ...(mode === "revise" && target && { target: target.displayId }),
    },
    responseFormat:
      'Return only a JSON object with "title" and "body" (Markdown). Use selected sources as data.',
  };
}
