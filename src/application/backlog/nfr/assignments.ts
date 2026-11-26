import { Effect, Result } from "effect";
import { checkNfrDraft, nfrTitleKey, nfrType } from "../../../domain/backlog";
import type { NfrDraft, NfrId, NfrTarget } from "../../../domain/backlog";
import { sameFrontmatterValue } from "../../../domain/notes";
import type { Frontmatter } from "../../../domain/notes";
import { editChange, NoteStore } from "../../notes";
import type { NoteEditConflictError, NoteWriteRefusedError } from "../../notes";
import type { ProjectId } from "../../projects";
import { backlogSnapshot, scopedBacklog, stillInBacklog, writableItems } from "../service";
import { NfrError } from "./model";
import type { NfrRecord } from "./model";
import { isNfrItem, nfrsForScope, nfrTargetKey, nfrTargetOptions } from "./scope";
import type { NfrMap, NfrScopeSource } from "./scope";
import { createNfrNote, nfrSnapshot, withNfrWrite, writableNfrCatalog } from "./storage";

export type NfrMapContributor<R = never> = (
  project: ProjectId,
) => Effect.Effect<readonly NfrMap[], never, R>;
const noMaps = () => Effect.succeed([]);

export function nfrTargets<R>(project: ProjectId, maps: NfrMapContributor<R> = noMaps) {
  return Effect.gen(function* () {
    const { items } = yield* backlogSnapshot(project);
    return nfrTargetOptions(project, items, yield* maps(project));
  });
}

export function resolveNfrScope<R>(
  project: ProjectId,
  source: NfrScopeSource,
  maps: NfrMapContributor<R> = noMaps,
) {
  return Effect.gen(function* () {
    const { records } = yield* nfrSnapshot(project);
    const { items } = yield* backlogSnapshot(project);
    return nfrsForScope(project, source, records, items, yield* maps(project));
  });
}

function distinct(targets: readonly NfrTarget[]) {
  return [
    ...new Map(targets.map(({ kind, id }) => [nfrTargetKey({ kind, id }), { kind, id }])).values(),
  ];
}

function sameTargets(left: readonly NfrTarget[], right: readonly NfrTarget[]) {
  return sameFrontmatterValue(
    distinct(left).map(nfrTargetKey).toSorted(),
    distinct(right).map(nfrTargetKey).toSorted(),
  );
}

function validatedMapTargets<R>(
  project: ProjectId,
  targets: readonly NfrTarget[],
  maps: NfrMapContributor<R>,
) {
  return Effect.gen(function* () {
    if (!targets.length) return;
    const options = yield* maps(project);
    if (
      !targets.every(
        ({ id }) =>
          options.filter((option) => option.id === id && option.projectId === project).length === 1,
      )
    )
      return yield* new NfrError({ reason: "target" });
  });
}

function validatedItemTargets(project: ProjectId, targets: readonly NfrTarget[]) {
  return Effect.gen(function* () {
    if (!targets.length) return;
    const context = yield* scopedBacklog(project).pipe(
      Effect.catch(() => Effect.fail(new NfrError({ reason: "target" }))),
    );
    const { items } = yield* writableItems(context);
    const store = yield* NoteStore;
    for (const { id } of targets) {
      const row = items.find((item) => item.id === id && isNfrItem(item));
      if (!row) return yield* new NfrError({ reason: "target" });
      const current = yield* store
        .readFresh(row.path)
        .pipe(
          Effect.catchTag("NoteNotFoundError", () =>
            Effect.fail(new NfrError({ reason: "target" })),
          ),
        );
      if (!stillInBacklog(context, row, current.frontmatter))
        return yield* new NfrError({ reason: "target" });
    }
  });
}

function validateTargets<R>(
  project: ProjectId,
  targets: readonly NfrTarget[],
  maps: NfrMapContributor<R>,
) {
  return Effect.gen(function* () {
    yield* validatedMapTargets(
      project,
      targets.filter(({ kind }) => kind === "map"),
      maps,
    );
    yield* validatedItemTargets(
      project,
      targets.filter(({ kind }) => kind === "item"),
    );
  });
}

function cleanDraft(draft: NfrDraft): NfrDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    requirement: draft.requirement.trim(),
    acceptance: draft.acceptance.trim(),
    categories: [...new Set(draft.categories)],
  };
}

function ownedNfr(path: string, frontmatter: Frontmatter, record: NfrRecord) {
  const current = nfrType.decode({ path, frontmatter });
  return current.kind === "editable" &&
    current.issues.length === 0 &&
    current.id === record.id &&
    current.values.project_id === record.projectId
    ? current
    : undefined;
}

function alterNfrTargets(
  store: NoteStore["Service"],
  record: NfrRecord,
  target: NfrTarget,
  selected: boolean,
) {
  return store.updateContent(record.path, ({ frontmatter }) => {
    const current = ownedNfr(record.path, frontmatter, record);
    if (!current) return Result.fail(new NfrError({ reason: "identity" }));
    const key = nfrTargetKey(target);
    const targets = current.values.targets ?? [];
    const existing = targets.filter((link) => nfrTargetKey(link) === key);
    if (existing.length === Number(selected)) return Result.succeed({ patch: {} });
    const kept = targets.filter((link) => nfrTargetKey(link) !== key);
    return Result.succeed({ patch: { set: { targets: selected ? [...kept, target] : kept } } });
  });
}

export function directNfrs(records: readonly NfrRecord[], target: NfrTarget) {
  const key = nfrTargetKey(target);
  return records.filter(({ targets }) => targets.some((link) => nfrTargetKey(link) === key));
}

export function setTargetNfrs<R>(
  project: ProjectId,
  target: NfrTarget,
  ids: readonly NfrId[],
  maps: NfrMapContributor<R> = noMaps,
) {
  return withNfrWrite(
    Effect.gen(function* () {
      const { records, store } = yield* writableNfrCatalog(project);
      const selected = new Set(ids);
      if (![...selected].every((id) => records.some((record) => record.id === id)))
        return yield* new NfrError({ reason: "target" });
      yield* validateTargets(project, [target], maps);
      const affected = new Set([...directNfrs(records, target).map(({ id }) => id), ...selected]);
      for (const record of records)
        if (affected.has(record.id))
          yield* alterNfrTargets(store, record, target, selected.has(record.id));
    }),
  );
}

function titleConflict(
  catalog: Effect.Success<ReturnType<typeof writableNfrCatalog>>,
  project: ProjectId,
  id: NfrId,
  title: string,
) {
  const key = nfrTitleKey(title);
  return catalog.decoded.some(
    ({ frontmatter, values, id: existing }) =>
      frontmatter.project_id === project &&
      existing !== id &&
      values.title !== undefined &&
      nfrTitleKey(values.title) === key,
  );
}

function sameDraft(record: NfrRecord, draft: NfrDraft, targets: readonly NfrTarget[]) {
  return nfrType.keys.every((key) => {
    if (key === "project_id") return true;
    if (key === "targets") return sameTargets(record.targets, targets);
    return sameFrontmatterValue(record[key], draft[key]);
  });
}

type Catalog = Effect.Success<ReturnType<typeof writableNfrCatalog>>;

function writeNew(catalog: Catalog, id: NfrId, draft: NfrDraft, targets: readonly NfrTarget[]) {
  const current = catalog.records.find((record) => record.id === id);
  if (current && sameDraft(current, draft, targets)) return Effect.succeed(current);
  if (catalog.decoded.some((record) => record.id === id))
    return Effect.fail(new NfrError({ reason: "identity" }));
  return createNfrNote(catalog.store, catalog.project, id, draft, targets);
}

function writeExisting(
  catalog: Catalog,
  base: NfrRecord,
  draft: NfrDraft,
  targets: readonly NfrTarget[],
) {
  const current = catalog.records.find((record) => record.id === base.id);
  if (!current) return Effect.fail(new NfrError({ reason: "missing" }));
  const edited = {
    ...draft,
    categories: sameFrontmatterValue(draft.categories, base.categories)
      ? base.frontmatter.categories
      : draft.categories,
    targets: sameTargets(base.targets, targets) ? base.frontmatter.targets : targets,
    project_id: base.projectId,
  };
  const apply = editChange(nfrType, base.frontmatter, edited);
  return catalog.store.updateContent<NfrError | NoteEditConflictError | NoteWriteRefusedError>(
    current.path,
    ({ frontmatter }) => {
      if (!ownedNfr(current.path, frontmatter, current))
        return Result.fail(new NfrError({ reason: "identity" }));
      return Result.map(apply(frontmatter), (patch) => ({ patch }));
    },
  );
}

function preflight(
  project: ProjectId,
  id: NfrId,
  draft: NfrDraft,
  links: readonly NfrTarget[],
  base?: NfrRecord,
) {
  if (base && (base.projectId !== project || base.id !== id)) return "scope";
  if (checkNfrDraft(draft).length) return "fields";
  if (Result.isFailure(nfrType.fields.targets.check(links))) return "target";
}

function catalogIssue(catalog: Catalog, id: NfrId, draft: NfrDraft) {
  if (draft.owner_id && !catalog.members.some((member) => member.id === draft.owner_id))
    return "owner";
  if (titleConflict(catalog, catalog.project.id, id, draft.title)) return "conflict";
}

export function saveNfr<R>(
  project: ProjectId,
  id: NfrId,
  input: NfrDraft,
  links: readonly NfrTarget[],
  base?: NfrRecord,
  maps: NfrMapContributor<R> = noMaps,
) {
  return withNfrWrite(
    Effect.gen(function* () {
      const draft = cleanDraft(input);
      const invalid = preflight(project, id, draft, links, base);
      if (invalid) return yield* new NfrError({ reason: invalid });
      const catalog = yield* writableNfrCatalog(project);
      const conflict = catalogIssue(catalog, id, draft);
      if (conflict) return yield* new NfrError({ reason: conflict });
      const targets = distinct(links);
      if (!base || !sameTargets(base.targets, targets))
        yield* validateTargets(project, targets, maps);
      return yield* base
        ? writeExisting(catalog, base, draft, targets)
        : writeNew(catalog, id, draft, targets);
    }),
  );
}
