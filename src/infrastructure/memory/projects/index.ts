import { Effect, Layer } from "effect";
import {
  availableProjectFolder,
  backlogBaseText,
  ProjectFiles,
  ProjectStorageError,
} from "../../../application/projects";
import { clashKey } from "../../../domain/notes";

export function memoryProjectFiles(
  occupied: (path: string) => boolean,
  isFolder: (path: string) => boolean,
) {
  const reserved = new Set<string>();
  const bases = new Map<string, string>();
  let failBase = false;
  const layer = Layer.succeed(ProjectFiles, {
    hasFolder: (path) => Effect.sync(() => isFolder(path) || reserved.has(clashKey(path))),
    reserveFolder: (parent, name) =>
      Effect.suspend(() => {
        const available = availableProjectFolder(name, (candidate) => {
          const path = `${parent}/${candidate}`;
          return occupied(path) || reserved.has(clashKey(path));
        });
        if (!available) return Effect.fail(new ProjectStorageError({ reason: "folder" }));
        const path = `${parent}/${available}`;
        reserved.add(clashKey(path));
        return Effect.succeed(path);
      }),
    ensureBacklog: (path, id) =>
      Effect.suspend(() => {
        const contents = backlogBaseText(id);
        const existing = bases.get(path);
        if (failBase || (existing !== undefined && existing !== contents)) {
          return Effect.fail(new ProjectStorageError({ reason: "base" }));
        }
        bases.set(path, contents);
        return Effect.void;
      }),
    hasBacklog: (path, id) =>
      Effect.suspend(() => {
        const existing = bases.get(path);
        return existing && existing !== backlogBaseText(id)
          ? Effect.fail(new ProjectStorageError({ reason: "base" }))
          : Effect.succeed(existing !== undefined);
      }),
  });
  return {
    layer,
    bases,
    failBase: (value: boolean) => {
      failBase = value;
    },
  };
}
