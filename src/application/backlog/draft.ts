import { Effect } from "effect";
import { validBacklogTitle } from "../../domain/backlog";
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
    state: kind === "UC" ? (base.states.find((state) => state === "Backlog") ?? "") : "",
    priority: "",
    owner: "",
    body: "",
  };
}

export function validSelections(draft: BacklogDraft, base: BacklogBase, original?: BacklogDraft) {
  if (backlogTitleIssue(draft.title)) return "title";
  if (draft.state && draft.state !== original?.state && !base.states.includes(draft.state))
    return "state";
  if (
    draft.priority &&
    draft.priority !== original?.priority &&
    !base.priorities.includes(draft.priority)
  )
    return "priority";
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
