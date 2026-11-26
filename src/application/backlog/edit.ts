import { Effect, Result } from "effect";
import type { Frontmatter } from "../../domain/notes";
import { NoteStore } from "../notes";
import type { BacklogBase, ProjectId } from "../projects";
import { draftProperties, manualPbiStageFields, ownerValue, validSelections } from "./draft";
import type { BacklogDraft } from "./draft";
import { BacklogError, backlogItems } from "./model";
import type { BacklogItem } from "./model";
import { revisePbi } from "./pbi-storage";
import { planningPlacement, planningReparent, verifyPeers } from "./placement";
import type { BacklogPlacement } from "./placement";
import {
  BacklogWrites,
  frontmatterPatch,
  matchesFields,
  scopedBacklog,
  stillInBacklog,
  writableRow,
} from "./service";
import type { BacklogContext } from "./service";

export type BacklogEdit = {
  readonly item: BacklogItem;
  readonly draft: BacklogDraft;
  readonly base: BacklogBase;
};

export const readBacklogItem = (project: ProjectId, key: string) =>
  Effect.gen(function* () {
    const context = yield* scopedBacklog(project);
    const { row, items } = yield* writableRow(context, key);
    const store = yield* NoteStore;
    const content = yield* store.readContent(row.path);
    if (!stillInBacklog(context, row, content.frontmatter))
      return yield* new BacklogError({ reason: "conflict" });
    const { base, others } = context;
    const updated = backlogItems(
      context.project,
      base,
      items.map(({ path, fields }) =>
        path === row.path ? content : { path, frontmatter: fields },
      ),
      others,
    ).items.find(({ path }) => path === row.path);
    if (!updated || updated.conflict) return yield* new BacklogError({ reason: "identity" });
    const { title, parent = "", state, owner, priority } = updated;
    return {
      item: updated,
      base,
      draft: { title, parent, state, owner, priority, body: content.body },
    } satisfies BacklogEdit;
  });

function sameMapping(before: BacklogBase, current: BacklogBase) {
  return (
    before.folder === current.folder &&
    before.state === current.state &&
    before.owner === current.owner &&
    before.priority === current.priority
  );
}

function changedProperties(
  next: BacklogDraft,
  before: BacklogDraft,
  base: BacklogBase,
  kind: BacklogItem["kind"],
  owner?: string,
) {
  const fields = draftProperties(next, base, owner);
  const changed = {
    title: next.title.trim() !== before.title,
    [base.state]: next.state !== before.state,
    [base.priority]: next.priority !== before.priority,
    [base.owner]: next.owner !== before.owner,
  };
  const selected = Object.fromEntries(Object.entries(fields).filter(([key]) => changed[key]));
  return kind === "UC" && changed[base.state]
    ? { ...selected, ...manualPbiStageFields(base, next.state) }
    : selected;
}

function rankChanges(
  context: BacklogContext,
  row: BacklogItem,
  items: readonly BacklogItem[],
  newParent: string | undefined,
  place?: BacklogPlacement,
) {
  return Effect.gen(function* () {
    if (newParent === undefined) {
      if (!place) return {};
      const location = yield* Effect.fromResult(planningPlacement(items, row, place));
      yield* verifyPeers(context, location.peers);
      return location.fields;
    }
    const destination = yield* Effect.fromResult(planningReparent(items, row, newParent));
    const order = yield* Effect.fromResult(destinationOrder(items, row, newParent, place));
    yield* verifyPeers(context, destination.peers);
    return { ...destination.fields, order: order ?? destination.fields.order };
  });
}

function destinationOrder(
  items: readonly BacklogItem[],
  row: BacklogItem,
  parent: string,
  place?: BacklogPlacement,
) {
  if (!place) return Result.succeed(undefined);
  const { target, zone } = place;
  if (zone === "inside")
    return target === parent
      ? Result.succeed(undefined)
      : Result.fail(new BacklogError({ reason: "parent" }));
  return Result.map(
    planningPlacement(items, row, { target, zone }, parent),
    ({ fields }) => fields.order,
  );
}

function revisionChanges(
  row: BacklogItem,
  fields: Frontmatter,
  current: Frontmatter,
  bodyChanged: boolean,
) {
  if (row.kind !== "UC" || !row.adopted) return;
  const title = Object.hasOwn(fields, "title") ? { title: fields.title } : {};
  return revisePbi(current, title, bodyChanged);
}

function writeDraft(
  context: BacklogContext,
  row: BacklogItem,
  before: BacklogEdit,
  draft: BacklogDraft,
  fields: Frontmatter,
) {
  const updateBody = draft.body !== before.draft.body;
  return NoteStore.use((store) =>
    store.updateContent(row.path, ({ frontmatter, body }) => {
      if (
        !stillInBacklog(context, row, frontmatter) ||
        !matchesFields(frontmatter, before.item.fields, fields) ||
        (updateBody && body !== before.draft.body && body !== draft.body)
      )
        return Result.fail(new BacklogError({ reason: "conflict" }));
      const revision = revisionChanges(row, fields, frontmatter, updateBody && body !== draft.body);
      return Result.succeed({
        patch: frontmatterPatch({ ...fields, ...revision }),
        ...(updateBody && { body: draft.body }),
      });
    }),
  );
}

export const saveBacklogItem = (
  project: ProjectId,
  before: BacklogEdit,
  draft: BacklogDraft,
  place?: BacklogPlacement,
) =>
  BacklogWrites.use(({ lock, recent, undo }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const context = yield* scopedBacklog(project);
        const { base } = context;
        const { row, items } = yield* writableRow(context, before.item.key);
        if (
          !sameMapping(before.base, base) ||
          !stillInBacklog(context, { ...before.item, path: row.path }, row.fields)
        )
          return yield* new BacklogError({ reason: "conflict" });
        const invalid = validSelections(draft, base, before.draft);
        if (invalid) return yield* new BacklogError({ reason: invalid });
        const owner =
          draft.owner === before.draft.owner ? undefined : yield* ownerValue(project, draft.owner);
        const fields = changedProperties(draft, before.draft, base, row.kind, owner);
        const newParent = draft.parent === before.draft.parent ? undefined : draft.parent;
        const rank = yield* rankChanges(context, row, items, newParent, place);
        const saved = yield* writeDraft(context, row, before, draft, { ...fields, ...rank });
        recent.set(saved.path, saved);
        const keys = Object.keys(rank);
        if (keys.length)
          undo.set(project, { key: row.key, before: before.item.fields, after: rank, keys });
        return saved;
      }),
    ),
  );
