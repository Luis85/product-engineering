import { Effect, Result } from "effect";
import { isCopilotProposalContent, safeProposalMarkdown } from "../../../domain/integrations";
import type { CopilotDraftKind, CopilotProposalContent } from "../../../domain/integrations";
import type { KnowledgeId, KnowledgeSourceLink } from "../../../domain/knowledge";
import {
  createKnowledge,
  knowledgeDetailRoute,
  newKnowledgeId,
  readKnowledgeNote,
  saveKnowledgeNote,
  validKnowledgeTitle,
} from "../../knowledge";
import type { KnowledgeNote } from "../../knowledge";
import { NoteEditConflictError } from "../../notes";
import type { ProjectId } from "../../projects";
import { ProviderChatError } from "./index";
import type { ChatRequest } from "./index";
import { copilotSources, readCopilotSource } from "./sources";
import type { CopilotSource } from "./sources";

export type CopilotProposal = {
  readonly id: KnowledgeId;
  readonly projectId: ProjectId;
  readonly provider: ChatRequest["provider"];
  readonly kind: CopilotDraftKind;
  readonly selected: readonly string[];
  readonly base?: KnowledgeNote;
};

type ProposalRequest = Omit<CopilotProposal, "id" | "base"> & { readonly revise?: string };
const draftKinds = new Set<string>(["vision", "jtbd", "research", "prd"]);

export function prepareCopilotProposal(request: ProposalRequest) {
  return Effect.gen(function* () {
    const { projectId, provider, selected, revise } = request;
    const id = yield* newKnowledgeId;
    const draft: CopilotProposal = { ...request, id };
    if (revise === undefined) return draft;
    const options = yield* copilotSources(projectId);
    const target = options.find(({ key }) => key === revise);
    const error = new ProviderChatError({ provider, reason: "target-unavailable" });
    if (!selected.includes(revise) || target?.kind !== "knowledge") return yield* error;
    const base = yield* readKnowledgeNote(projectId, target.record.id, target.path).pipe(
      Effect.mapError(() => error),
    );
    if (!base.editable) return yield* error;
    const kind = draftKinds.has(base.kind) ? (base.kind as CopilotDraftKind) : request.kind;
    return { ...draft, kind, base };
  });
}

function sourceLinks(options: readonly CopilotSource[]) {
  const links = options.map((source): KnowledgeSourceLink => ({
    kind: source.kind,
    id: source.kind === "pbi" ? source.id : source.record.id,
  }));
  const references = options.flatMap(({ path, displayId }) =>
    /[[\]#|\r\n]/u.test(path) || path.length > 820
      ? []
      : ["[[" + path + "|" + displayId.replace(/[[\]|]/gu, "") + "]]"],
  );
  return { links, references };
}

function validatedSources(proposal: CopilotProposal, reviving: boolean) {
  return Effect.gen(function* () {
    const { projectId, selected, provider, base } = proposal;
    const options = yield* copilotSources(projectId);
    const error = new ProviderChatError({ provider, reason: "source-unavailable" });
    return yield* Effect.forEach([...new Set(selected)], (key) =>
      Effect.gen(function* () {
        const option = options.find((source) => source.key === key);
        if (option) {
          const read = yield* Effect.result(readCopilotSource(projectId, option));
          if (Result.isSuccess(read) && read.success !== undefined) return [option];
        }
        if (reviving && key === "knowledge:" + base?.id) return [];
        return yield* error;
      }),
    ).pipe(Effect.map((groups) => groups.flat()));
  });
}

export function applyCopilotProposal(
  projectId: ProjectId,
  proposal: CopilotProposal,
  content: CopilotProposalContent,
  saveAsNew: boolean,
) {
  return Effect.gen(function* () {
    const { base, kind, provider } = proposal;
    if (projectId !== proposal.projectId || (base && projectId !== base.projectId))
      return yield* new NoteEditConflictError({ conflicts: [] });
    const title = content.title.trim();
    if (!isCopilotProposalContent(content) || !validKnowledgeTitle(kind, title))
      return yield* new ProviderChatError({ provider, reason: "invalid-proposal" });
    const draft = { title, body: safeProposalMarkdown(content.body) };
    const selected = yield* validatedSources(proposal, saveAsNew);
    if (base && !saveAsNew)
      return yield* reviseNote(
        proposal.id,
        base,
        draft,
        selected.filter(({ key }) => key !== "knowledge:" + base.id),
      );
    return yield* createProposedNote(proposal, draft, selected);
  });
}

function reviseNote(
  id: KnowledgeId,
  base: KnowledgeNote,
  draft: CopilotProposalContent,
  selected: readonly CopilotSource[],
) {
  const sources = sourceLinks(selected);
  const references = [...new Set([...(base.values.references ?? []), ...sources.references])];
  const links = new Map(
    [...(base.values.source_links ?? []), ...sources.links].map((link) => [
      link.kind + ":" + link.id,
      link,
    ]),
  );
  return Effect.map(
    saveKnowledgeNote(
      base,
      draft.body,
      { title: draft.title, approval: "draft", references },
      {
        id,
        links: [...links.values()],
      },
    ),
    (saved) => knowledgeDetailRoute(base.projectId, saved.id),
  );
}

function createProposedNote(
  proposal: CopilotProposal,
  draft: CopilotProposalContent,
  selected: readonly CopilotSource[],
) {
  return Effect.gen(function* () {
    const { projectId, id, kind } = proposal;
    const { title, body } = draft;
    const sources = sourceLinks(selected);
    const knowledge = yield* createKnowledge(
      { projectId, id, proposal: { body, ...sources } },
      {
        title,
        kind,
        actor_type: "",
        owner_id: "",
        job_ids: [],
        vision_id: "",
      },
    );
    if (knowledge.frontmatter.id !== id) return yield* new NoteEditConflictError({ conflicts: [] });
    return knowledgeDetailRoute(projectId, id);
  });
}
