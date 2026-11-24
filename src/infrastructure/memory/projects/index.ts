import { Effect, Layer } from "effect";
import {
  availableProjectFolder,
  backlogBaseText,
  backlogConfiguration,
  backlogFilter,
  ProjectFiles,
  ProjectStorageError,
} from "../../../application/projects";
import type { BacklogBase } from "../../../application/projects";
import { clashKey } from "../../../domain/notes";

export function memoryProjectFiles(
  occupied: (path: string) => boolean,
  isFolder: (path: string) => boolean,
) {
  const reserved = new Set<string>();
  const bases = new Map<string, string>();
  const configByPath = new Map<string, unknown>();
  const openedBases: string[] = [];
  const references = new Map<string, Uint8Array<ArrayBuffer>>();
  let failBase = false;
  const read = (
    path: string,
    id: Parameters<typeof backlogFilter>[0],
  ): Effect.Effect<BacklogBase | undefined, ProjectStorageError> =>
    Effect.suspend(() => {
      const existing = bases.get(path);
      if (existing === undefined) return Effect.succeed(undefined);
      const value =
        configByPath.get(path) ??
        (existing === backlogBaseText(id)
          ? { filters: backlogFilter(id), views: [{ type: "table" }] }
          : undefined);
      const config = backlogConfiguration(value, path, id);
      return config
        ? Effect.succeed(config)
        : Effect.fail(new ProjectStorageError({ reason: "base" }));
    });
  const layer = Layer.succeed(ProjectFiles, {
    hasFolder: (path) => Effect.sync(() => isFolder(path) || reserved.has(clashKey(path))),
    findReference: (link) =>
      Effect.sync(() => {
        const path = /^!?\[\[([^#|\]]+)/u.exec(link)?.[1];
        return path && references.has(path)
          ? { path, extension: path.split(".").at(-1)?.toLowerCase() ?? "" }
          : undefined;
      }),
    readReference: (path) => Effect.sync(() => references.get(path)),
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
        if (failBase) {
          return Effect.fail(new ProjectStorageError({ reason: "base" }));
        }
        return Effect.tap(read(path, id), (existing) =>
          Effect.sync(() => {
            if (!existing) bases.set(path, contents);
          }),
        ).pipe(Effect.asVoid);
      }),
    hasBacklog: (path, id) => Effect.map(read(path, id), Boolean),
    readBacklog: read,
    openBacklog: (path) =>
      Effect.suspend(() => {
        if (!bases.has(path)) return Effect.fail(new ProjectStorageError({ reason: "base" }));
        openedBases.push(path);
        return Effect.void;
      }),
  });
  return {
    layer,
    bases,
    openedBases,
    seedReference: (path: string, bytes: Uint8Array<ArrayBuffer>) => references.set(path, bytes),
    seedBacklog(path: string, text: string, config: unknown) {
      bases.set(path, text);
      configByPath.set(path, config);
    },
    failBase: (value: boolean) => {
      failBase = value;
    },
  };
}
