import { Effect } from "effect";
import {
  mappedBoardStage,
  normalizedBoardStage,
  parentKind,
  validBacklogTitle,
} from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import type { Frontmatter } from "../../domain/notes";
import { projectMemberChoices } from "../projects";
import type { BacklogBase, ProjectId } from "../projects";
import { BacklogError, rawLink } from "./model";

export type BacklogDraft = {
  title: string;
  parent: string;
  state: string;
  priority: string;
  owner: string;
  body: string;
};

export function backlogTitleIssue(title: string) {
  return !validBacklogTitle(title.trim()) ? "title" : undefined;
}

export function initialBacklogDraft(kind: BacklogKind, base: BacklogBase): BacklogDraft {
  return {
    title: "",
    parent: "",
    state: initialBacklogState(kind, base),
    priority: "",
    owner: "",
    body: "",
  };
}

export function initialBacklogState(kind: BacklogKind, base: BacklogBase) {
  if (kind === "UC") return mappedBoardStage("Backlog", base.states);
  return parentKind(kind) === "UC" ? mappedBoardStage("Open", base.states) : "";
}

function validSelection(
  value: string,
  current: string | undefined,
  options: readonly string[],
  fallback?: string,
) {
  return !value || value === current || value === fallback || options.includes(value);
}

export function validSelections(
  draft: BacklogDraft,
  base: BacklogBase,
  original?: BacklogDraft,
  defaultState?: string,
) {
  if (backlogTitleIssue(draft.title)) return "title";
  if (!validSelection(draft.state, original?.state, base.states, defaultState)) return "state";
  if (!validSelection(draft.priority, original?.priority, base.priorities)) return "priority";
}

export function ownerName(owner: string) {
  const link = rawLink(owner);
  return link ? link.slice(link.lastIndexOf("/") + 1).replace(/\.md$/i, "") : owner;
}

export function ownerValue(project: ProjectId, owner: string) {
  return Effect.gen(function* () {
    if (!owner) return;
    const choices = yield* projectMemberChoices(project);
    const member = choices?.find(({ id, name }) => id === owner || name === ownerName(owner));
    if (!member) return yield* new BacklogError({ reason: "owner" });
    return member.name;
  });
}

export function draftProperties(
  draft: BacklogDraft,
  base: BacklogBase,
  owner?: string,
): Frontmatter {
  return {
    title: draft.title.trim(),
    [base.state]: draft.state || undefined,
    [base.priority]: draft.priority || undefined,
    [base.owner]: owner,
  };
}

export function manualPbiStageFields(base: BacklogBase, state: string): Frontmatter {
  return {
    [base.state]: state || undefined,
    pbi_stage_choice: normalizedBoardStage(state),
  };
}
