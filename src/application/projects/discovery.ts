import { Effect, Stream } from "effect";
import type { Frontmatter } from "../../domain/notes";
import { isProjectId, projectType } from "../../domain/projects";
import type { ProjectId } from "../../domain/projects";
import { noteChanges, noteSnapshot } from "../notes";
import { projectDetailFields } from "./errors";

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

type DecodedProject = ReturnType<typeof projectType.decode<Frontmatter>>;

export type ProjectSettings = Project & { readonly frontmatter: Frontmatter };

export function registrationFolder(path: string) {
  return path.slice(0, Math.max(0, path.lastIndexOf("/")));
}

function effectiveFolder(path: string, override?: string) {
  return override === "/" ? "" : (override ?? registrationFolder(path));
}

function invalidProjectDetails(issues: readonly { readonly key: string }[]) {
  return issues.some(
    ({ key }) => key !== "repository" && projectDetailFields.some((field) => field === key),
  );
}

export function registeredProject(note: DecodedProject): ProjectSettings | undefined {
  if (note.kind !== "editable" || !isProjectId(note.id) || invalidProjectDetails(note.issues))
    return;
  const { name, description, repository, branch, backlog_base: base } = note.values;
  if (!name || !description || !branch || !base) return;
  const folder = effectiveFolder(note.path, note.values.vault_folder);
  return {
    id: note.id,
    name,
    description,
    repository: repository ?? "",
    branch,
    folder,
    notePath: note.path,
    backlogBasePath: folder ? `${folder}/${base}` : base,
    frontmatter: note.frontmatter,
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
