import { Effect, Layer } from "effect";
import { normalizePath, parseYaml, TFolder } from "obsidian";
import type { Vault } from "obsidian";
import { resolveFolderPath } from "../../../application/notes/adapter";
import {
  availableProjectFolder,
  backlogBaseText,
  backlogFilter,
  ProjectFiles,
  ProjectStorageError,
} from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";
import { clashKey } from "../../../domain/notes";

function folderAt(vault: Vault, path: string) {
  return path === "/" ? vault.getRoot() : vault.getFolderByPath(path);
}

async function ownsBacklog(vault: Vault, path: string, projectId: ProjectId) {
  if (!vault.getAbstractFileByPath(path)) return false;
  const file = vault.getFileByPath(path);
  if (!file) throw new Error("Backlog path is occupied");
  const contents: unknown = parseYaml(await vault.read(file));
  if (
    typeof contents !== "object" ||
    contents === null ||
    !("filters" in contents) ||
    contents.filters !== backlogFilter(projectId)
  ) {
    throw new Error("Backlog path is occupied");
  }
  return true;
}

export function projectFilesLayer(vault: Vault) {
  return Layer.succeed(ProjectFiles, {
    reserveFolder: (parent, name) =>
      Effect.tryPromise({
        try: async () => {
          const resolved = resolveFolderPath(normalizePath(parent), (path) =>
            (folderAt(vault, path)?.children ?? []).flatMap((entry) =>
              entry instanceof TFolder ? [entry.name] : [],
            ),
          );
          const occupied = new Set(
            folderAt(vault, resolved)?.children.map((entry) => clashKey(entry.name)),
          );
          const available = availableProjectFolder(name, (candidate) =>
            occupied.has(clashKey(candidate)),
          );
          if (!available) throw new Error("No available project folder");
          return (await vault.createFolder(normalizePath(`${resolved}/${available}`))).path;
        },
        catch: () => new ProjectStorageError({ reason: "folder" }),
      }),
    ensureBacklog: (path, projectId) =>
      Effect.tryPromise({
        try: async () => {
          const target = normalizePath(path);
          if (!(await ownsBacklog(vault, target, projectId)))
            await vault.create(target, backlogBaseText(projectId));
        },
        catch: () => new ProjectStorageError({ reason: "base" }),
      }),
    hasBacklog: (path, projectId) =>
      Effect.tryPromise({
        try: () => ownsBacklog(vault, normalizePath(path), projectId),
        catch: () => new ProjectStorageError({ reason: "base" }),
      }),
  });
}
