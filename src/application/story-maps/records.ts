import { Effect, Stream } from "effect";
import type { KnowledgeId } from "../../domain/knowledge";
import type { NoteValues } from "../../domain/notes";
import {
  isStoryMapActivity,
  isStoryMapCard,
  isStoryMapCardLink,
  isStoryMapId,
  isStoryMapSlice,
  isStoryMapStep,
  isStoryMapWork,
  storyMapType,
} from "../../domain/story-maps";
import { noteChanges, noteSnapshot } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";

type Decoded = ReturnType<typeof storyMapType.decode<Note["frontmatter"]>>;

function coreFields(values: NoteValues<typeof storyMapType.fields>) {
  const { project_id, display_id, title, persona, goal, cards } = values;
  if (!project_id || !display_id || !title || !persona || !goal || !cards) return;
  return {
    projectId: project_id,
    displayId: display_id,
    title,
    persona,
    goal,
    cards: cards.filter(isStoryMapCard),
  };
}

function collectionFields(values: NoteValues<typeof storyMapType.fields>) {
  return {
    jobIds: values.job_ids ?? [],
    references: values.references ?? [],
    activities: (values.activities ?? []).filter(isStoryMapActivity),
    steps: (values.steps ?? []).filter(isStoryMapStep),
    slices: (values.slices ?? []).filter(isStoryMapSlice),
    cardLinks: (values.card_links ?? []).filter(isStoryMapCardLink),
    work: (values.story_work ?? []).filter(isStoryMapWork),
  };
}

function recordOf(note: Decoded) {
  if (note.kind !== "editable" || note.issues.length || !isStoryMapId(note.id)) return;
  const fields = coreFields(note.values);
  if (!fields) return;
  return {
    ...fields,
    id: note.id,
    path: note.path,
    frontmatter: note.frontmatter,
    prdId: note.values.prd_id,
    ...collectionFields(note.values),
  };
}

export type StoryMapRecord = NonNullable<ReturnType<typeof recordOf>>;
export const decodeStoryMap = (note: Note) => recordOf(storyMapType.decode(note));

export function storyMapBacklinks(
  projectId: ProjectId,
  recordId: KnowledgeId,
  maps: readonly StoryMapRecord[],
  kind: "prd" | "jtbd" = "prd",
) {
  return maps.filter(
    (map) =>
      map.projectId === projectId &&
      (kind === "prd" ? map.prdId === recordId : map.jobIds.includes(recordId)),
  );
}

function projectStoryMaps(
  project: ProjectId,
  source: {
    readonly notes: readonly Decoded[];
    readonly ready: boolean;
    readonly failure: unknown;
  },
) {
  const maps = source.notes
    .flatMap((note) => {
      const record = recordOf(note);
      return record?.projectId === project ? [record] : [];
    })
    .toSorted((a, b) => a.displayId.localeCompare(b.displayId, undefined, { numeric: true }));
  return { ready: source.ready, failed: source.failure !== undefined, maps };
}

export const storyMapsSnapshot = (project: ProjectId) =>
  Effect.map(noteSnapshot(storyMapType), (source) => projectStoryMaps(project, source));
export const storyMapsChanges = (project: ProjectId) =>
  Stream.map(noteChanges(storyMapType), (source) => projectStoryMaps(project, source));
