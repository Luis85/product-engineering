import { Effect, Stream } from "effect";
import {
  backlogInputs,
  backlogSnapshot,
  nfrCatalogRoute,
  nfrChanges,
  nfrSnapshot,
  pbiDetailRoute,
  readPbiDetail,
} from "../../backlog";
import type { BacklogItem, NfrRecord } from "../../backlog";
import { domainModelRoute } from "../../domain-model";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeNoteOptions,
  readKnowledgeNote,
} from "../../knowledge";
import type { KnowledgeRecord } from "../../knowledge";
import { NoteStore } from "../../notes";
import type { ProjectId } from "../../projects";
import type { Route } from "../../routes";
import {
  decodeStoryMap,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
} from "../../story-maps";
import type { StoryMapRecord } from "../../story-maps";
import { nfrType } from "../../../domain/backlog";
import type { AppServices } from "../../app-services";
import type { AppError } from "../../errors";

export type CopilotSource = {
  readonly key: string;
  readonly displayId: string;
  readonly title: string;
  readonly path: string;
  readonly route: Route;
} & (
  | { readonly kind: "knowledge"; readonly record: KnowledgeRecord }
  | { readonly kind: "pbi"; readonly id: string }
  | { readonly kind: "map"; readonly record: StoryMapRecord }
  | { readonly kind: "nfr"; readonly record: NfrRecord }
);

function knowledgeSources(records: readonly KnowledgeRecord[]): readonly CopilotSource[] {
  return records.map((record) => {
    const { projectId, id, title, displayId } = record;
    return {
      kind: "knowledge",
      key: "knowledge:" + id,
      title,
      path: record.path,
      displayId,
      route:
        record.kind === "entity"
          ? domainModelRoute(projectId, id)
          : knowledgeDetailRoute(projectId, id),
      record,
    };
  });
}

function pbiSources(projectId: ProjectId, items: readonly BacklogItem[]): readonly CopilotSource[] {
  return items.flatMap(({ kind, adopted, conflict, id, title, path }) =>
    kind === "UC" && adopted && !conflict && id
      ? [
          {
            kind: "pbi",
            key: "pbi:" + id,
            displayId: id,
            title,
            path,
            route: pbiDetailRoute(projectId, id),
            id,
          },
        ]
      : [],
  );
}

function mapSources(maps: readonly StoryMapRecord[]): readonly CopilotSource[] {
  return maps.map((record) => ({
    kind: "map",
    key: "map:" + record.id,
    displayId: record.displayId,
    title: record.title,
    path: record.path,
    route: storyMapsRoute(record.projectId, record.id),
    record,
  }));
}

function nfrSources(records: readonly NfrRecord[]): readonly CopilotSource[] {
  return records.map((record) => ({
    kind: "nfr",
    key: "nfr:" + record.id,
    displayId: record.id,
    title: record.title,
    path: record.path,
    route: nfrCatalogRoute(record.projectId, record.id),
    record,
  }));
}

export function copilotSources(projectId: ProjectId) {
  return Effect.map(
    Effect.all([
      knowledgeNoteOptions(projectId),
      backlogSnapshot(projectId),
      storyMapsSnapshot(projectId),
      nfrSnapshot(projectId),
    ]),
    ([knowledge, { items }, { maps }, { records }]) => [
      ...knowledgeSources(knowledge),
      ...pbiSources(projectId, items),
      ...mapSources(maps),
      ...nfrSources(records),
    ],
  );
}

export function copilotSourceChanges(projectId: ProjectId) {
  return Stream.mergeAll(
    [
      Stream.map(knowledgeChanges, () => undefined),
      Stream.map(backlogInputs, () => undefined),
      Stream.map(storyMapsChanges(projectId), () => undefined),
      Stream.map(nfrChanges(projectId), () => undefined),
    ],
    { concurrency: "unbounded" },
  ).pipe(Stream.mapEffect(() => copilotSources(projectId)));
}

export function copilotRouteSource(route: Route, projectId: ProjectId): string | undefined {
  if (!("projectId" in route) || route.projectId !== projectId) return;
  return routedArtifact(route);
}

function routedArtifact(route: Extract<Route, { readonly projectId: ProjectId }>) {
  if (route.name === "project-record" && route.reference.kind === "knowledge")
    return sourceKey("knowledge", route.reference.recordId);
  if (route.name === "project-usecase") return sourceKey("pbi", route.pbiId);
  if (route.name === "project-story-maps") return sourceKey("map", route.mapId);
  if (route.name === "project-backlog")
    return route.tab === "nfrs" ? sourceKey("nfr", route.nfr) : sourceKey("pbi", route.item);
  if (route.name === "project-domainmodel") return sourceKey("knowledge", route.selection);
  if (route.name === "project-trace") return sourceKey("pbi", route.pbi);
}

function sourceKey(kind: CopilotSource["kind"], id: string | undefined) {
  return id ? kind + ":" + id : undefined;
}

export function readCopilotSource(
  projectId: ProjectId,
  source: CopilotSource,
): Effect.Effect<string | undefined, AppError, AppServices> {
  switch (source.kind) {
    case "knowledge":
      return Effect.map(
        readKnowledgeNote(projectId, source.record.id, source.record.path),
        (note) => note.body,
      );
    case "pbi":
      return Effect.map(readPbiDetail(projectId, source.id), ({ edit, criteria }) =>
        JSON.stringify({ body: edit.draft.body, criteria }),
      );
    case "map":
      return NoteStore.use(({ readContent }) =>
        Effect.map(readContent(source.record.path), (note) => {
          const map = decodeStoryMap(note);
          if (map?.id !== source.record.id || map.projectId !== projectId) return;
          return JSON.stringify({
            body: note.body,
            persona: map.persona,
            goal: map.goal,
            activities: map.activities,
            steps: map.steps,
            slices: map.slices,
            cards: map.cards,
          });
        }),
      );
    case "nfr":
      return NoteStore.use(({ readFresh }) =>
        Effect.map(readFresh(source.record.path), (note) => {
          const nfr = nfrType.decode(note);
          if (
            nfr.kind !== "editable" ||
            nfr.issues.length ||
            nfr.id !== source.record.id ||
            nfr.values.project_id !== projectId
          )
            return;
          const { requirement, acceptance, categories } = nfr.values;
          return JSON.stringify({ requirement, acceptance, categories });
        }),
      );
  }
}
