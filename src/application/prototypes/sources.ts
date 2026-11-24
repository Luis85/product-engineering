import { Effect, Stream } from "effect";
import { nfrType } from "../../domain/backlog";
import { isPrototypeSource } from "../../domain/prototypes";
import type { PrototypeSource } from "../../domain/prototypes";
import {
  backlogInputs,
  backlogRoute,
  backlogSnapshot,
  nfrCatalogRoute,
  nfrChanges,
  nfrSnapshot,
  pbiDetailRoute,
  readBacklogItem,
  resolveBacklogItem,
} from "../backlog";
import type { BacklogItem } from "../backlog";
import { NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import { decodeStoryMap, storyMapsChanges, storyMapsRoute, storyMapsSnapshot } from "../story-maps";

export type PrototypeSourceOption = {
  readonly source: PrototypeSource;
  readonly title: string;
  readonly displayId: string;
  readonly adopted?: boolean;
};

export function backlogPrototypeSource(
  projectId: ProjectId,
  item: Pick<BacklogItem, "kind" | "id" | "conflict">,
) {
  const source = { projectId, kind: item.kind, id: item.id };
  return !item.conflict && isPrototypeSource(source) ? source : undefined;
}

const prototypeSourcesSnapshot = (projectId: ProjectId) =>
  Effect.gen(function* () {
    const { items } = yield* backlogSnapshot(projectId);
    const { maps } = yield* storyMapsSnapshot(projectId);
    const { records } = yield* nfrSnapshot(projectId);
    return [
      ...items.flatMap((item) => {
        const source = backlogPrototypeSource(projectId, item);
        return source
          ? [{ source, title: item.title, displayId: source.id, adopted: item.adopted }]
          : [];
      }),
      ...maps.map(
        ({ id, title, displayId }) =>
          ({ source: { kind: "map", projectId, id }, title, displayId }) as const,
      ),
      ...records.map(
        ({ id, title }) =>
          ({ source: { kind: "nfr", projectId, id }, title, displayId: id }) as const,
      ),
    ] satisfies readonly PrototypeSourceOption[];
  });

export const prototypeSourcesChanges = (project: ProjectId) =>
  Stream.merge(backlogInputs, Stream.merge(nfrChanges(project), storyMapsChanges(project))).pipe(
    Stream.mapEffect(() => prototypeSourcesSnapshot(project)),
  );

export function prototypeSourceRoute({ source, adopted }: PrototypeSourceOption) {
  const { projectId, kind, id } = source;
  if (kind === "map") return storyMapsRoute(projectId, id);
  if (kind === "nfr") return nfrCatalogRoute(projectId, id);
  return kind === "UC" && adopted ? pbiDetailRoute(projectId, id) : backlogRoute(projectId, id);
}

function freshSource(path: string) {
  return NoteStore.use(({ readFresh }) => readFresh(path)).pipe(
    Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () => Effect.succeed(undefined)),
  );
}

function resolveMap(source: Extract<PrototypeSource, { kind: "map" }>) {
  return Effect.gen(function* () {
    const { id, projectId } = source;
    const { maps } = yield* storyMapsSnapshot(projectId);
    const indexed = maps.find((map) => map.id === id);
    const note = indexed && (yield* freshSource(indexed.path));
    const record = note && decodeStoryMap(note);
    if (record?.id === id && record.projectId === projectId)
      return { source, title: record.title, displayId: record.displayId };
  });
}

function resolveNfr(source: Extract<PrototypeSource, { kind: "nfr" }>) {
  return Effect.gen(function* () {
    const { id, projectId } = source;
    const { records } = yield* nfrSnapshot(projectId);
    const indexed = records.find((record) => record.id === id);
    const note = indexed && (yield* freshSource(indexed.path));
    const record = note && nfrType.decode(note);
    if (
      record?.kind === "editable" &&
      !record.issues.length &&
      record.id === id &&
      record.values.project_id === projectId &&
      record.values.title
    )
      return { source, title: record.values.title, displayId: id };
  });
}

function resolveItem(source: Exclude<PrototypeSource, { kind: "map" | "nfr" }>) {
  return Effect.gen(function* () {
    const { kind, id, projectId } = source;
    const indexed = yield* resolveBacklogItem(projectId, id);
    if (indexed?.id !== id || indexed.kind !== kind) return;
    const current = yield* readBacklogItem(projectId, id).pipe(
      Effect.catchTag(["BacklogError", "NoteNotFoundError", "NoteUnreadableError"], () =>
        Effect.succeed(undefined),
      ),
    );
    if (current?.item.id === id && current.item.kind === kind)
      return { source, title: current.item.title, displayId: id, adopted: current.item.adopted };
  });
}

export function resolvePrototypeSource(projectId: ProjectId, source: PrototypeSource) {
  return Effect.gen(function* () {
    if (source.projectId !== projectId || !isPrototypeSource(source)) return;
    if (source.kind === "map") return yield* resolveMap(source);
    if (source.kind === "nfr") return yield* resolveNfr(source);
    return yield* resolveItem(source);
  });
}
