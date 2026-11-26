import { Effect, Result } from "effect";
import type { KnowledgeId } from "../../domain/knowledge";
import { backlogGitSource } from "../backlog";
import type { BacklogItem } from "../backlog";
import { inspectArtifactGit } from "../git";
import type { GitArtifactSource } from "../git";
import {
  knowledgeDetailRoute,
  knowledgeGitSource,
  knowledgeNoteOptions,
  readKnowledgeNote,
} from "../knowledge";
import { ProjectFiles } from "../projects";
import type { ProjectId } from "../projects";
import type { RequestPackage } from "./delivery-package";

type Identity = { readonly id: string; readonly displayId: string; readonly path: string };
type PackageSource = Identity & { readonly commit?: string; readonly markdown: string };
type KnowledgeReference = Identity & { readonly kind: "knowledge"; readonly id: KnowledgeId };
type Reference =
  | KnowledgeReference
  | (Identity & { readonly kind: "backlog" })
  | (Identity & { readonly kind: "packaged"; readonly commit?: string });
type Link = NonNullable<RequestPackage["links"]>[number];
const wikiLinkPattern = /\[\[([^\]|#]*)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/g;
const noteTarget = (value: string) =>
  value.normalize("NFC").trim().replace(/\.md$/i, "").toLowerCase();

function matchesTarget(reference: Reference, target: string) {
  return [
    reference.id,
    reference.displayId,
    reference.path,
    reference.path.split("/").at(-1) ?? "",
  ].some((candidate) => noteTarget(candidate) === target);
}

function resolveReference(
  files: ProjectFiles["Service"],
  references: ReadonlyMap<string, Reference>,
  source: PackageSource,
  target: string,
) {
  return Effect.gen(function* () {
    if (!target) return references.get(source.id);
    const all = [...references.values()];
    const named = all.filter((reference) => matchesTarget(reference, noteTarget(target)));
    if (named.length > 1) return;
    const match = named[0];
    const linked = yield* files.findReference(`[[${target}]]`, source.path);
    if (!linked) return match;
    if (linked.extension !== "md" || (match && linked.path !== match.path)) return;
    const atPath = all.filter(({ path }) => path === linked.path);
    if (atPath.length === 1) return atPath[0];
  });
}

function cleanJournal(source: GitArtifactSource) {
  return Effect.map(Effect.result(inspectArtifactGit(source)), (journal) =>
    Result.isSuccess(journal) && journal.success.state === "clean" ? journal.success : undefined,
  );
}

function knowledgeCommit(project: ProjectId, { id, path }: KnowledgeReference) {
  return Effect.gen(function* () {
    const read = yield* Effect.result(readKnowledgeNote(project, id, path));
    const note = Result.isSuccess(read) ? read.success : undefined;
    if (!note?.editable || note.values.approval !== "approved") return;
    const journal = yield* cleanJournal(knowledgeGitSource(knowledgeDetailRoute(project, id)));
    if (!journal || journal.target.path !== path) return;
    const tracked = new TextDecoder("utf-8", { ignoreBOM: true }).decode(journal.current.bytes);
    if (tracked === note.text) return journal.revisions[0]?.oid;
  });
}

function referenceCommit(project: ProjectId, reference: Reference) {
  switch (reference.kind) {
    case "packaged":
      return Effect.succeed(reference.commit);
    case "knowledge":
      return knowledgeCommit(project, reference);
    case "backlog":
      return Effect.map(
        cleanJournal(backlogGitSource(project, reference.id)),
        (journal) => journal?.revisions[0]?.oid,
      );
  }
}

function referenceCatalog(
  project: ProjectId,
  packaged: readonly PackageSource[],
  items: readonly BacklogItem[],
) {
  return Effect.gen(function* () {
    const knowledge = yield* knowledgeNoteOptions(project);
    const known: readonly Reference[] = knowledge.map(({ id, displayId, path }) => ({
      id,
      displayId,
      path,
      kind: "knowledge",
    }));
    const backlog: readonly Reference[] = items.flatMap((item) =>
      item.id && item.adopted && !item.conflict
        ? [{ id: item.id, displayId: item.id, path: item.path, kind: "backlog" as const }]
        : [],
    );
    const included: readonly Reference[] = packaged.map((source) => ({
      ...source,
      kind: "packaged",
    }));
    return new Map([...known, ...backlog, ...included].map((source) => [source.id, source]));
  });
}

export function packageLinks(
  projectId: ProjectId,
  packaged: readonly PackageSource[],
  items: readonly BacklogItem[],
) {
  return Effect.gen(function* () {
    const matches = packaged.flatMap((source) =>
      [...source.markdown.matchAll(wikiLinkPattern)].map(([, target = "", anchor, alias]) => ({
        source,
        target,
        anchor,
        alias,
      })),
    );
    if (!matches.length) return [];
    const sources = yield* referenceCatalog(projectId, packaged, items);
    const files = yield* ProjectFiles;
    const cache = new Map<string, string | undefined>();
    return yield* Effect.forEach(matches, ({ source, target, anchor, alias }) =>
      Effect.gen(function* (): Effect.fn.Return<
        Link,
        never,
        Effect.Services<ReturnType<typeof referenceCommit>>
      > {
        const reference = yield* resolveReference(files, sources, source, target);
        if (reference && !cache.has(reference.id))
          cache.set(reference.id, yield* referenceCommit(projectId, reference));
        const commit = reference && cache.get(reference.id);
        return {
          source: source.id,
          target,
          ...(anchor && { anchor }),
          ...(alias && { alias }),
          ...(reference && commit && { artifact: { id: reference.id, commit } }),
        };
      }),
    );
  });
}
