import { Effect, Stream } from "effect";
import { isProjectId, projectType } from "../../domain/projects";
import type { ProjectId } from "../../domain/projects";
import { noteChanges, noteSnapshot } from "../notes";

export type Project = {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly repository: string;
  readonly branch: string;
  readonly notePath: string;
  readonly folder: string;
  readonly backlogBasePath: string;
};

type DecodedProject = ReturnType<typeof projectType.decode>;

export function registeredProject(note: DecodedProject): Project | undefined {
  if (note.kind !== "editable" || note.issues.length || !isProjectId(note.id)) return;
  const { name, description, repository, branch, backlog_base: base } = note.values;
  if (!name || !description || !repository || !branch || !base) return;
  const folder = note.path.slice(0, Math.max(0, note.path.lastIndexOf("/")));
  return {
    id: note.id,
    name,
    description,
    repository,
    branch,
    folder,
    notePath: note.path,
    backlogBasePath: folder ? `${folder}/${base}` : base,
  };
}

function projectList({
  ready,
  failure,
  notes,
}: {
  readonly ready: boolean;
  readonly failure: unknown;
  readonly notes: readonly DecodedProject[];
}) {
  const projects = notes.flatMap((note) => {
    const project = registeredProject(note);
    return project ? [project] : [];
  });
  return {
    ready,
    failed: failure !== undefined,
    projects: projects.toSorted(
      (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    ),
    invalid: notes.length - projects.length,
  };
}

export const projectSnapshot = Effect.map(noteSnapshot(projectType), projectList);
export const projectChanges = Stream.map(noteChanges(projectType), projectList);

export const projectById = (id: ProjectId) =>
  Effect.map(projectSnapshot, ({ projects }) => projects.find((project) => project.id === id));
