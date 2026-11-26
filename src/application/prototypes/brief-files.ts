import { Effect } from "effect";
import { isInFolder } from "../notes";
import { ProjectFiles, projectSnapshot } from "../projects";
import type { ProjectId } from "../projects";
import { unique } from "./brief-backlog";
import type { BriefFileReference } from "./brief-backlog";

const excerptLimit = 512 * 1024;
const textExtensions = new Set(["md", "markdown", "txt", "csv", "log", "json", "yaml", "yml"]);
type Target = { readonly path: string; readonly extension: string };
type Excerpt =
  | { readonly status: "unavailable" | "binary" | "included" }
  | {
      readonly status: "text";
      readonly text: string;
      readonly truncated: boolean;
      readonly hash: string;
    };

function belongsToScope(
  path: string,
  projectId: ProjectId,
  projects: readonly {
    readonly folder: string;
    readonly id: ProjectId;
  }[],
) {
  const matches = projects
    .filter(({ folder }) => isInFolder(path, folder))
    .toSorted((left, right) => right.folder.length - left.folder.length);
  const closest = matches[0];
  return !closest || closest.id === projectId;
}

function decodeExcerpt(bytes: Uint8Array<ArrayBuffer>) {
  const prefix = bytes.subarray(0, excerptLimit);
  if (prefix.includes(0)) return;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(prefix, {
      stream: bytes.length > excerptLimit,
    });
  } catch {
    return;
  }
}

function excerpt(files: ProjectFiles["Service"], target: Target | undefined, included: boolean) {
  return Effect.gen(function* (): Effect.fn.Return<Excerpt> {
    if (!target) return { status: "unavailable" };
    if (included) return { status: "included" };
    if (!textExtensions.has(target.extension)) return { status: "binary" };
    const bytes = yield* files.readReference(target.path);
    if (!bytes) return { status: "unavailable" };
    const text = decodeExcerpt(bytes);
    if (text === undefined) return { status: "binary" };
    const hash = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", bytes));
    return {
      status: "text",
      text,
      truncated: bytes.length > excerptLimit,
      hash: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    };
  });
}

export function briefFiles(
  projectId: ProjectId,
  references: readonly BriefFileReference[],
  included: ReadonlySet<string>,
) {
  return Effect.gen(function* () {
    if (!references.length) return [];
    const files = yield* ProjectFiles;
    const { projects } = yield* projectSnapshot;
    const resolved = yield* Effect.forEach(references, (reference) =>
      Effect.map(files.findReference(reference.reference, reference.sourcePath), (target) => ({
        reference,
        target: target && belongsToScope(target.path, projectId, projects) ? target : undefined,
      })),
    );
    const distinct = new Map<string, (typeof resolved)[number][]>();
    for (const entry of resolved) {
      const key = entry.target?.path ?? entry.reference.reference;
      const matches = distinct.get(key) ?? [];
      matches.push(entry);
      distinct.set(key, matches);
    }
    return yield* Effect.forEach(
      distinct,
      ([key, entries]) => {
        const target = entries[0]?.target;
        return Effect.map(excerpt(files, target, included.has(key)), (contents) => ({
          path: target?.path,
          references: unique(entries.map(({ reference }) => reference.reference)),
          origins: unique(entries.map(({ reference }) => reference.origin)),
          ...contents,
        }));
      },
      { concurrency: 4 },
    );
  });
}
