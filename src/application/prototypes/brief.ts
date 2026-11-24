import { Effect } from "effect";
import { isKnowledgeId } from "../../domain/knowledge";
import { prototypeDesignFields, prototypeDesignKinds } from "../../domain/prototypes";
import type { PrototypeSource } from "../../domain/prototypes";
import { backlogSnapshot, nfrSnapshot, resolveNfrScope } from "../backlog";
import type { NfrScopeSource } from "../backlog";
import { resolveDomainScope } from "../domain-model";
import { knowledgeNoteOptions, readKnowledgeNote, resolveKnowledgeNote } from "../knowledge";
import { NoteStore } from "../notes";
import { readFreshProject } from "../projects";
import {
  decodeStoryMap,
  storyMapDomainContribution,
  storyMapNfrContribution,
  storyMapsSnapshot,
} from "../story-maps";
import type { StoryMapRecord } from "../story-maps";
import { briefBacklog, briefDocumentReferences, briefFileReferences } from "./brief-backlog";
import type { BriefDocumentReference } from "./brief-backlog";
import { briefFiles } from "./brief-files";
import { PrototypeError } from "./errors";
import { decodePrototype } from "./records";
import type { PrototypeRecord } from "./records";
import { resolvePrototypeSource } from "./sources";

export function readPrototype(base: PrototypeRecord) {
  return Effect.gen(function* () {
    const store = yield* NoteStore;
    const note = yield* store.readFresh(base.path);
    const current = decodePrototype(note);
    if (!current || current.id !== base.id || current.projectId !== base.projectId)
      return yield* new PrototypeError({ reason: "identity" });
    return current;
  });
}

function briefMap(source: PrototypeSource) {
  return Effect.gen(function* () {
    if (source.kind !== "map") return;
    const { maps } = yield* storyMapsSnapshot(source.projectId);
    const candidate = maps.find(({ id }) => id === source.id);
    if (!candidate) return;
    const store = yield* NoteStore;
    const current = yield* Effect.map(store.readFresh(candidate.path), decodeStoryMap).pipe(
      Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () =>
        Effect.succeed(undefined),
      ),
    );
    if (current?.id === source.id && current.projectId === source.projectId) return current;
  });
}

function journey(map: StoryMapRecord | undefined) {
  if (!map) return;
  const { id, displayId, title, persona, goal, activities, steps, slices, cards, sliceDeferrals } =
    map;
  return {
    id,
    displayId,
    title,
    persona,
    goal,
    activities,
    steps,
    slices,
    cards,
    sliceDeferrals,
    links: map.cardLinks.filter(
      ({ projectId, cardId }) =>
        projectId === map.projectId && cards.some((card) => card.id === cardId),
    ),
    work: map.work.map((item) => ({
      cardId: item.cardId,
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
    })),
  };
}

function scopeContext(source: PrototypeSource) {
  return Effect.gen(function* () {
    const { projectId, id, kind } = source;
    const target: NfrScopeSource =
      source.kind === "nfr"
        ? { kind: "nfr", id: source.id }
        : { kind: kind === "map" ? "map" : "item", id };
    const nfr =
      kind === "nfr"
        ? (yield* nfrSnapshot(projectId)).records.find((row) => row.id === id)
        : undefined;
    const targets = target.kind === "nfr" ? (nfr?.targets ?? []) : [target];
    const [nfrs, domain] = yield* Effect.all(
      [
        resolveNfrScope(projectId, target, storyMapNfrContribution),
        resolveDomainScope(projectId, targets, storyMapDomainContribution),
      ],
      { concurrency: 2 },
    );
    return { nfrs, domain, targets };
  });
}

function designReferences(record: PrototypeRecord) {
  return prototypeDesignKinds.flatMap((kind) => {
    const id = record.values[prototypeDesignFields[kind]];
    return id ? [{ id, kind, origin: record.displayId }] : [];
  });
}

function material(project: PrototypeRecord["projectId"], reference: BriefDocumentReference) {
  return Effect.gen(function* () {
    if (!isKnowledgeId(reference.id)) return;
    const candidate = yield* resolveKnowledgeNote(project, reference.id);
    if (!candidate || candidate.kind !== reference.kind) return;
    return yield* readKnowledgeNote(project, candidate.id, candidate.path);
  }).pipe(
    Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () => Effect.succeed(undefined)),
  );
}

function documents(project: PrototypeRecord["projectId"], references: BriefDocumentReference[]) {
  return Effect.gen(function* () {
    const pending = [...references];
    const seen = new Map<
      string,
      {
        readonly reference: BriefDocumentReference;
        readonly note: Effect.Success<ReturnType<typeof material>>;
        readonly origins: Set<string>;
      }
    >();
    for (const reference of pending) {
      const key = reference.kind + ":" + reference.id;
      const previous = seen.get(key);
      if (previous) {
        previous.origins.add(reference.origin);
        continue;
      }
      const note = yield* material(project, reference);
      seen.set(key, { reference, note, origins: new Set([reference.origin]) });
      if (!note) continue;
      const origin = note.displayId;
      if (note.values.vision_id)
        pending.push({ id: note.values.vision_id, kind: "vision", origin });
      for (const id of note.values.job_ids ?? []) pending.push({ id, kind: "jtbd", origin });
    }
    return [...seen.values()].map(({ reference, note, origins }) => ({
      id: reference.id,
      kind: reference.kind,
      origins: [...origins],
      ...(note && {
        displayId: note.displayId,
        path: note.path,
        title: note.title,
        body: note.body,
        requirement: note.values.requirement_id,
      }),
    }));
  });
}

export function resolvePrototypeBrief(base: PrototypeRecord) {
  return Effect.gen(function* () {
    const record = yield* readPrototype(base);
    const { projectId, source, sourceId, title, description, displayId } = record;
    const project = yield* readFreshProject(projectId);
    if (!project) return yield* new PrototypeError({ reason: "project" });
    const common = {
      project: { id: project.id, name: project.name },
      title,
      description,
      displayId,
      sourceId,
    };
    const selection =
      source?.projectId === projectId
        ? yield* resolvePrototypeSource(projectId, source)
        : undefined;
    if (!source || !selection) return { ...common, source, selection, inputs: undefined };
    const [map, { items }, context] = yield* Effect.all(
      [briefMap(source), backlogSnapshot(projectId), scopeContext(source)],
      { concurrency: 3 },
    );
    const backlog = yield* briefBacklog(projectId, source, map, items);
    const references = [...briefDocumentReferences(map, backlog), ...designReferences(record)];
    const materials = yield* documents(projectId, references);
    const known = yield* knowledgeNoteOptions(projectId);
    const scopedEntities = new Set(context.domain.entities.map(({ id }) => id));
    const includedPaths = new Set([
      ...materials.flatMap(({ path }) => (path ? [path] : [])),
      ...known.flatMap(({ id, path }) => (scopedEntities.has(id) ? [path] : [])),
    ]);
    const files = yield* briefFiles(projectId, briefFileReferences(map, backlog), includedPaths);
    return {
      ...common,
      source,
      selection,
      inputs: {
        journey: journey(map),
        backlog: backlog.map((item) => {
          if (item.missing) return item;
          const { path: _path, references: _references, ...content } = item;
          return content;
        }),
        documents: materials.map(({ path: _path, ...note }) => note),
        files,
        ...context,
      },
    };
  });
}

export type ResolvedPrototypeBrief = Effect.Success<ReturnType<typeof resolvePrototypeBrief>>;
