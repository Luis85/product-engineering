import { Effect } from "effect";
import { hostTypes, isBacklogId, parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { recordFileName, recordIdIssue } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import { NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import {
  backlogTitleIssue,
  draftProperties,
  initialBacklogDraft,
  ownerValue,
  validSelections,
} from "./draft";
import type { BacklogDraft } from "./draft";
import { BacklogError, backlogItems, backlogLink, inBacklog } from "./model";
import type { BacklogItem } from "./model";
import { nextRank, verifyPeers } from "./placement";
import {
  BacklogWrites,
  identityFields,
  newBacklogIdentity,
  scopedBacklog,
  writableItems,
} from "./service";
import type { BacklogContext, BacklogIdentity } from "./service";

export type BacklogCreation = {
  readonly epic: BacklogIdentity;
  readonly feature: BacklogIdentity;
  readonly item: BacklogIdentity;
};

type BacklogCreateDraft = BacklogDraft & {
  readonly kind: BacklogKind;
  readonly epicTitle?: string;
  readonly featureTitle?: string;
  readonly epic?: string;
};

export function newBacklogCreation(kind: BacklogKind) {
  return Effect.all({
    epic: newBacklogIdentity("EP"),
    feature: newBacklogIdentity("FE"),
    item: newBacklogIdentity(kind),
  });
}

type PlannedItem = {
  readonly identity: BacklogIdentity;
  readonly kind: BacklogKind;
  readonly fields: Frontmatter;
  readonly body: string;
  readonly parent?: string;
};

function existingParent(
  items: readonly BacklogItem[],
  key: string | undefined,
  kind?: BacklogKind,
) {
  return items.find((item) => item.key === key && item.kind === kind && !item.conflict);
}

function pbiParents(
  items: readonly BacklogItem[],
  identity: BacklogCreation,
  draft: BacklogCreateDraft,
) {
  return Effect.gen(function* () {
    const epic = existingParent(items, draft.epic, "EP");
    if (!epic && (draft.epic || !draft.epicTitle))
      return yield* new BacklogError({ reason: "parent" });
    const feature: PlannedItem = {
      identity: identity.feature,
      kind: "FE",
      parent: epic?.key ?? identity.epic.id,
      fields: { title: draft.featureTitle?.trim() },
      body: "",
    };
    if (epic) return [feature];
    return [
      {
        identity: identity.epic,
        kind: "EP",
        fields: { title: draft.epicTitle?.trim() },
        body: "",
      },
      feature,
    ] satisfies PlannedItem[];
  });
}

function planParents(
  items: readonly BacklogItem[],
  identity: BacklogCreation,
  draft: BacklogCreateDraft,
) {
  return Effect.gen(function* () {
    const required = parentKind(draft.kind);
    const existing = existingParent(items, draft.parent, required);
    if (existing || (!required && !draft.parent))
      return { parent: existing?.key, prerequisites: [] };
    if (draft.parent || draft.kind !== "UC" || !draft.featureTitle)
      return yield* new BacklogError({ reason: "parent" });
    const prerequisites = yield* pbiParents(items, identity, draft);
    return { parent: identity.feature.id, prerequisites };
  });
}

function plannedIssue(context: BacklogContext, entry: PlannedItem, items: readonly BacklogItem[]) {
  const { identity: key, kind } = entry;
  if (backlogTitleIssue(String(entry.fields.title))) return "title";
  if (
    !isBacklogId(key.id) ||
    !key.id.startsWith(kind + "-") ||
    recordIdIssue("backlog", key.record)
  )
    return "identity";
  const prior = items.filter(({ id }) => id === key.id);
  if (
    prior.length > 1 ||
    prior.some(({ conflict, fields }) => conflict || fields.id !== key.record)
  )
    return "duplicate";
  if (!creationFields(context, entry, items)) return "base";
}

function planCreation(
  context: BacklogContext,
  items: readonly BacklogItem[],
  identity: BacklogCreation,
  draft: BacklogCreateDraft,
) {
  return Effect.gen(function* () {
    const invalid = validSelections(draft, context.base);
    if (invalid) return yield* new BacklogError({ reason: invalid });
    const owner = yield* ownerValue(context.project.id, draft.owner);
    const { parent, prerequisites } = yield* planParents(items, identity, draft);
    const properties = draftProperties(
      {
        ...draft,
        state: draft.state || initialBacklogDraft(draft.kind, context.base).state,
      },
      context.base,
      owner,
    );
    const planned: readonly PlannedItem[] = [
      ...prerequisites,
      {
        identity: identity.item,
        kind: draft.kind,
        fields: properties,
        body: draft.body,
        ...(parent && { parent }),
      },
    ];
    for (const entry of planned) {
      const reason = plannedIssue(context, entry, items);
      if (reason) return yield* new BacklogError({ reason });
    }
    const parents = items.filter(({ key }) => planned.some((entry) => entry.parent === key));
    yield* verifyPeers(context, parents);
    return planned;
  });
}

function creationFields(
  context: BacklogContext,
  entry: PlannedItem,
  items: readonly BacklogItem[],
) {
  const { base, project, others } = context;
  const name = recordFileName(String(entry.fields.title), hostTypes[entry.kind]);
  const frontmatter = {
    ...Object.fromEntries(Object.entries(entry.fields).filter(([, value]) => value !== undefined)),
    ...identityFields(project.id, entry.identity),
    type: hostTypes[entry.kind],
    order: nextRank(items),
  };
  const path = (base.folder ? base.folder + "/" : "") + name + ".md";
  return inBacklog({ path, frontmatter }, project, base, others)
    ? { name, frontmatter }
    : undefined;
}

export const createBacklogItem = (
  project: ProjectId,
  identity: BacklogCreation,
  draft: BacklogCreateDraft,
) =>
  BacklogWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const context = yield* scopedBacklog(project);
          const { base, others } = context;
          const { items } = yield* writableItems(context);
          const planned = yield* planCreation(context, items, identity, draft);
          const all = items.map(({ path, fields }) => ({ path, frontmatter: fields }));
          const store = yield* NoteStore;
          let current = items;
          for (const entry of planned) {
            if (current.some(({ id }) => id === entry.identity.id)) continue;
            const fields = creationFields(context, entry, current);
            if (!fields) return yield* new BacklogError({ reason: "base" });
            const parent = current.find(({ key }) => key === entry.parent);
            if (entry.parent && !parent) return yield* new BacklogError({ reason: "parent" });
            if (parent) yield* verifyPeers(context, [parent]);
            const note = yield* store.create({
              folder: base.folder,
              name: fields.name,
              frontmatter: {
                ...fields.frontmatter,
                ...(parent && { parent: backlogLink(parent.path) }),
              },
              body: entry.body,
            });
            recent.set(note.path, note);
            all.push(note);
            current = backlogItems(context.project, base, all, others).items;
          }
          const created = current.find(({ id }) => id === identity.item.id);
          if (!created) return yield* new BacklogError({ reason: "identity" });
          return created;
        }),
      ),
    ),
  );
