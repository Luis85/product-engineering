import { Context, Effect, Layer, Result, Semaphore } from "effect";
import { clashKey, recordFileName, recordId, schemaMarker } from "../../domain/notes";
import { isProjectId, projectType, validBacklogBaseName } from "../../domain/projects";
import type { ProjectId } from "../../domain/projects";
import { editChange, IdGenerator, NoteEditConflictError, NoteStore, recordFolder } from "../notes";
import type { FrontmatterChange, Note } from "../notes";
import { SettingsService } from "../shell";
import { projectById, registeredProject, registrationFolder } from "./discovery";
import type { Project, ProjectSettings } from "./discovery";
import { InvalidProjectError, projectDetailFields, ProjectStorageError } from "./errors";
import { ProjectFiles } from "./ports";

export type ProjectDraft = {
  readonly name: string;
  readonly description: string;
  readonly repository: string;
};

const NEW_PROJECT_DEFAULTS = { branch: "main", backlog_base: "Backlog.base" } as const;

export function projectDraftIssues(draft: ProjectDraft) {
  const values = trimmed(draft);
  const { issues } = projectType.check({ ...values, ...NEW_PROJECT_DEFAULTS });
  const fields = issues.flatMap(({ key }) =>
    key === "name" || key === "description" || key === "repository" ? [key] : [],
  );
  return values.repository ? fields : [...fields, "repository" as const];
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
    readonly recent: Map<ProjectId, ProjectSettings>;
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

export type ProjectDetails = ProjectDraft & {
  readonly branch: string;
  readonly vault_folder: string;
  readonly backlog_base: string;
};

export function projectDetails(project: Project): ProjectDetails {
  const { name, description, repository, branch, folder, backlogBasePath } = project;
  return {
    name,
    description,
    repository,
    branch,
    vault_folder: folder || "/",
    backlog_base: backlogBasePath.slice(backlogBasePath.lastIndexOf("/") + 1),
  };
}

function trimmedDetails(details: ProjectDetails, previous: ProjectDetails): ProjectDetails {
  const trimChanges = (field: keyof ProjectDetails) =>
    details[field] === previous[field] ? previous[field] : details[field].trim();
  return {
    name: trimChanges("name"),
    description: trimChanges("description"),
    repository: trimChanges("repository"),
    branch: trimChanges("branch"),
    vault_folder: trimChanges("vault_folder"),
    backlog_base: trimChanges("backlog_base"),
  };
}

export function projectDetailsIssues(details: ProjectDetails, base: ProjectSettings) {
  const original = projectDetails(base);
  const values = trimmedDetails(details, original);
  const { issues } = projectType.check(values);
  const fields = projectDetailFields.filter(
    (key) => details[key] !== original[key] && issues.some((issue) => issue.key === key),
  );
  if (values.backlog_base !== original.backlog_base && !validBacklogBaseName(values.backlog_base)) {
    if (!fields.includes("backlog_base")) fields.push("backlog_base");
  }
  return fields;
}

function validateLocation(candidate: ProjectSettings, notes: readonly Note[]) {
  return Effect.gen(function* () {
    const files = yield* ProjectFiles;
    const available = yield* files.hasFolder(candidate.folder);
    const assigned = notes.some((note) => {
      const project = registeredProject(projectType.decode(note));
      return (
        project &&
        project.id !== candidate.id &&
        [project.folder, registrationFolder(project.notePath)].some(
          (folder) => clashKey(folder) === clashKey(candidate.folder),
        )
      );
    });
    if (!available || assigned) return yield* new InvalidProjectError({ fields: ["vault_folder"] });
    yield* files
      .hasBacklog(candidate.backlogBasePath, candidate.id)
      .pipe(Effect.mapError(() => new InvalidProjectError({ fields: ["backlog_base"] })));
  });
}

export function saveProjectDetails(base: ProjectSettings, details: ProjectDetails) {
  return ProjectWrites.use(({ lock }) =>
    Semaphore.withPermit(lock)(
      Effect.gen(function* () {
        const fields = projectDetailsIssues(details, base);
        if (fields.length) return yield* new InvalidProjectError({ fields });
        const store = yield* NoteStore;
        const current = yield* liveProject(store, base.id);
        if (!current) return yield* new ProjectStorageError({ reason: "identity" });
        const previous = projectDetails(base);
        const values = trimmedDetails(details, previous);
        const location =
          values.vault_folder !== previous.vault_folder ||
          values.backlog_base !== previous.backlog_base;
        const apply = editChange(projectType, base.frontmatter, {
          ...base.frontmatter,
          ...values,
          vault_folder:
            values.vault_folder === previous.vault_folder
              ? base.frontmatter.vault_folder
              : values.vault_folder,
          repository:
            values.repository === previous.repository
              ? base.frontmatter.repository
              : values.repository || undefined,
        });
        if (location) {
          const preview = yield* Effect.fromResult(apply(current.frontmatter));
          const candidate = registeredProject(
            projectType.decode({
              path: current.notePath,
              frontmatter: { ...current.frontmatter, ...preview.set },
            }),
          );
          if (!candidate) return yield* new ProjectStorageError({ reason: "identity" });
          yield* validateLocation(candidate, yield* store.list);
        }
        const note = yield* store.update(current.notePath, (frontmatter) => {
          if (location) {
            const conflicts = (["vault_folder", "backlog_base"] as const).flatMap((key) =>
              frontmatter[key] === current.frontmatter[key]
                ? []
                : [
                    {
                      key,
                      base: current.frontmatter[key],
                      edited: values[key],
                      current: frontmatter[key],
                    },
                  ],
            );
            if (conflicts.length) return Result.fail(new NoteEditConflictError({ conflicts }));
          }
          return apply(frontmatter);
        });
        return yield* savedProject(note);
      }),
    ),
  );
}

function savedProject(note: Note) {
  const project = registeredProject(projectType.decode(note));
  return project
    ? Effect.succeed(project)
    : Effect.fail(new ProjectStorageError({ reason: "identity" }));
}

export function updateProjectFrontmatter<E>(projectId: ProjectId, update: FrontmatterChange<E>) {
  return ProjectWrites.use(({ lock }) =>
    Semaphore.withPermit(lock)(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        const project = yield* liveProject(store, projectId);
        if (!project) return yield* new ProjectStorageError({ reason: "identity" });
        const note = yield* store.update<E | ProjectStorageError>(
          project.notePath,
          (frontmatter) => {
            if (
              registeredProject(projectType.decode({ path: project.notePath, frontmatter }))?.id !==
              projectId
            ) {
              return Result.fail(new ProjectStorageError({ reason: "identity" }));
            }
            return update(frontmatter);
          },
        );
        return yield* savedProject(note);
      }),
    ),
  );
}

export function readFreshProject(projectId: ProjectId) {
  return ProjectWrites.use(({ lock }) =>
    Semaphore.withPermit(lock)(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        const known = yield* liveProject(store, projectId);
        if (!known) return;
        const note = yield* store.readFresh(known.notePath);
        const project = registeredProject(projectType.decode(note));
        return project?.id === projectId ? project : undefined;
      }),
    ),
  );
}
