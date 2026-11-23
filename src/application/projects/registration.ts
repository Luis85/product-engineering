import { Context, Effect, Layer, Semaphore } from "effect";
import { recordFileName, recordId, schemaMarker } from "../../domain/notes";
import { isProjectId, projectType } from "../../domain/projects";
import type { ProjectId } from "../../domain/projects";
import { IdGenerator, NoteStore, recordFolder } from "../notes";
import { SettingsService } from "../shell";
import { projectById, registeredProject } from "./discovery";
import type { Project } from "./discovery";
import { InvalidProjectError, ProjectStorageError } from "./errors";
import { ProjectFiles } from "./ports";

export type ProjectDraft = {
  readonly name: string;
  readonly description: string;
  readonly repository: string;
};

const NEW_PROJECT_DEFAULTS = { branch: "main", backlog_base: "Backlog.base" } as const;

export function projectDraftIssues(draft: ProjectDraft) {
  const { issues } = projectType.check({ ...trimmed(draft), ...NEW_PROJECT_DEFAULTS });
  return issues.flatMap(({ key }) =>
    key === "name" || key === "description" || key === "repository" ? [key] : [],
  );
}

function trimmed({ name, description, repository }: ProjectDraft): ProjectDraft {
  return { name: name.trim(), description: description.trim(), repository: repository.trim() };
}

export const newProjectId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(projectType.type, uuid);
    if (!isProjectId(id)) throw new Error("The host generated an invalid project ID");
    return id;
  }),
);

class ProjectWrites extends Context.Service<
  ProjectWrites,
  {
    readonly lock: Semaphore.Semaphore;
    readonly reservations: Map<ProjectId, string>;
    readonly recent: Map<ProjectId, Project>;
  }
>()("product-engineering/application/ProjectWrites") {}

export const projectWritesLayer = Layer.effect(
  ProjectWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, reservations: new Map(), recent: new Map() })),
);

function liveProject(store: NoteStore["Service"], id: ProjectId) {
  return Effect.gen(function* () {
    const matches = (yield* store.list).flatMap((note) => {
      if (note.frontmatter.id !== id) return [];
      const decoded = projectType.decode(note);
      return decoded.kind === "not-this-type" ? [] : [decoded];
    });
    if (matches.length === 0) return;
    const project = matches.length === 1 && matches[0] && registeredProject(matches[0]);
    if (!project) return yield* new ProjectStorageError({ reason: "identity" });
    return project;
  });
}

function folderName(name: string): string {
  const safe = recordFileName(name, "Project");
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe) ? `Project ${safe}` : safe;
}

function reserve(draft: ProjectDraft) {
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    const { rootFolder } = yield* settings.current;
    const files = yield* ProjectFiles;
    return yield* files.reserveFolder(
      recordFolder(rootFolder, projectType),
      folderName(draft.name),
    );
  });
}

function register(store: NoteStore["Service"], folder: string, id: ProjectId, draft: ProjectDraft) {
  return Effect.gen(function* () {
    const note = yield* store.create({
      folder,
      name: "Project",
      frontmatter: {
        schema: schemaMarker(projectType.type, projectType.version),
        id,
        ...draft,
        ...NEW_PROJECT_DEFAULTS,
      },
    });
    const project = registeredProject(projectType.decode(note));
    if (!project) return yield* new ProjectStorageError({ reason: "identity" });
    return project;
  });
}

export function createProject(projectId: ProjectId, draft: ProjectDraft) {
  return ProjectWrites.use(({ lock, reservations, recent }) =>
    Semaphore.withPermit(lock)(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const fields = projectDraftIssues(draft);
          if (fields.length) return yield* new InvalidProjectError({ fields });
          if (!isProjectId(projectId))
            return yield* new ProjectStorageError({ reason: "identity" });
          const store = yield* NoteStore;
          const existing = yield* liveProject(store, projectId);
          let project = existing ?? recent.get(projectId);
          if (!project) {
            const values = trimmed(draft);
            const folder = reservations.get(projectId) ?? (yield* reserve(values));
            reservations.set(projectId, folder);
            project = yield* register(store, folder, projectId, values);
            recent.set(projectId, project);
          }
          reservations.delete(projectId);
          if (existing) recent.delete(projectId);
          const files = yield* ProjectFiles;
          yield* files.ensureBacklog(project.backlogBasePath, project.id);
          return project;
        }),
      ),
    ),
  );
}

export function repairProjectBacklog(projectId: ProjectId) {
  return ProjectWrites.use(({ lock, recent }) =>
    Semaphore.withPermit(lock)(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        const project = (yield* liveProject(store, projectId)) ?? recent.get(projectId);
        if (!project) return yield* new ProjectStorageError({ reason: "identity" });
        const files = yield* ProjectFiles;
        return yield* files.ensureBacklog(project.backlogBasePath, project.id);
      }),
    ),
  );
}

export const projectBacklogStatus = (projectId: ProjectId) =>
  Effect.gen(function* () {
    const project = yield* projectById(projectId);
    if (!project) return yield* new ProjectStorageError({ reason: "identity" });
    const files = yield* ProjectFiles;
    return yield* files.hasBacklog(project.backlogBasePath, project.id);
  });
