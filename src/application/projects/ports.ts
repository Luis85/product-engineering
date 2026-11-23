import { Context } from "effect";
import type { Effect } from "effect";
import { clashName, MAX_NAME_ATTEMPTS } from "../../domain/notes";
import type { ProjectId } from "../../domain/projects";
import type { ProjectStorageError } from "./errors";

export class ProjectFiles extends Context.Service<
  ProjectFiles,
  {
    readonly reserveFolder: (
      parent: string,
      name: string,
    ) => Effect.Effect<string, ProjectStorageError>;
    readonly ensureBacklog: (
      path: string,
      projectId: ProjectId,
    ) => Effect.Effect<void, ProjectStorageError>;
    readonly hasBacklog: (
      path: string,
      projectId: ProjectId,
    ) => Effect.Effect<boolean, ProjectStorageError>;
  }
>()("product-engineering/application/ProjectFiles") {}

export function backlogBaseText(projectId: ProjectId): string {
  return `filters: '${backlogFilter(projectId)}'\nviews:\n  - type: table\n    name: Backlog\n    order:\n      - file.name\n`;
}

export const backlogFilter = (projectId: ProjectId) => `note.project_id == "${projectId}"`;

export function availableProjectFolder(name: string, taken: (name: string) => boolean) {
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
    const candidate = clashName(name, attempt);
    if (!taken(candidate)) return candidate;
  }
}
