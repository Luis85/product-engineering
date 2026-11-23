import { Effect, Layer } from "effect";
import { normalizePath, parseYaml, TFolder } from "obsidian";
import type { App, Vault } from "obsidian";
import { resolveFolderPath } from "../../../application/notes/adapter";
import {
  availableProjectFolder,
  backlogBaseText,
  backlogConfiguration,
  ProjectFiles,
  ProjectStorageError,
} from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";
import { clashKey } from "../../../domain/notes";

function folderAt(vault: Vault, path: string) {
  return path === "/" ? vault.getRoot() : vault.getFolderByPath(path);
}

async function readBacklog(vault: Vault, path: string, projectId: ProjectId) {
  if (!vault.getAbstractFileByPath(path)) {
    const separator = path.lastIndexOf("/");
    const folder = path.slice(0, Math.max(0, separator)) || "/";
    const name = clashKey(path.slice(separator + 1));
    if (folderAt(vault, folder)?.children.some((entry) => clashKey(entry.name) === name)) {
      throw new Error("Backlog path is occupied");
    }
    return;
  }
  const file = vault.getFileByPath(path);
  if (!file) throw new Error("Backlog path is occupied");
  const contents: unknown = parseYaml(await vault.read(file));
  const config = backlogConfiguration(contents, path, projectId);
  if (!config) throw new Error("Backlog path is occupied or unsupported");
  return config;
}

export function projectFilesLayer(vault: Vault, workspace?: App["workspace"]) {
  const read = (path: string, projectId: ProjectId) =>
    Effect.tryPromise({
      try: () => readBacklog(vault, normalizePath(path), projectId),
      catch: () => new ProjectStorageError({ reason: "base" }),
    });
  return Layer.succeed(ProjectFiles, {
    hasFolder: (path) => Effect.sync(() => folderAt(vault, path || "/") !== null),
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
          if (!(await readBacklog(vault, target, projectId)))
            await vault.create(target, backlogBaseText(projectId));
        },
        catch: () => new ProjectStorageError({ reason: "base" }),
      }),
    hasBacklog: (path, projectId) => Effect.map(read(path, projectId), Boolean),
    readBacklog: read,
    openBacklog: (path) =>
      Effect.tryPromise({
        try: async () => {
          const file = vault.getFileByPath(normalizePath(path));
          if (file?.extension.toLowerCase() !== "base" || !workspace)
            throw new Error("Base unavailable");
          await workspace.getLeaf("tab").openFile(file, { active: true });
        },
        catch: () => new ProjectStorageError({ reason: "base" }),
      }),
  });
}
