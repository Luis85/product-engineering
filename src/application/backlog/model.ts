import { Schema } from "effect";
import { backlogKind, backlogType, isBacklogId, parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { clashKey } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import type { Note } from "../notes";
import { isInFolder } from "../notes";
import type { BacklogBase, Project } from "../projects";

export class BacklogError extends Schema.TaggedError<BacklogError>()("BacklogError", {
  reason: Schema.Literals([
    "scope",
    "base",
    "missing",
    "duplicate",
    "identity",
    "title",
    "parent",
    "state",
    "priority",
    "owner",
    "rank",
    "conflict",
  ]),
}) {}

export type BacklogItem = {
  readonly key: string;
  readonly id?: string;
  readonly kind: BacklogKind;
  readonly path: string;
  readonly title: string;
  readonly state: string;
  readonly priority: string;
  readonly owner: string;
  readonly parent?: string;
  readonly brokenParent: boolean;
  readonly rank?: number;
  readonly conflict: boolean;
  readonly adopted: boolean;
  readonly fields: Frontmatter;
};

export type BacklogSnapshot = {
  readonly ready: boolean;
  readonly base?: BacklogBase;
  readonly items: readonly BacklogItem[];
  readonly duplicates: readonly string[];
  readonly issue?: "base" | "scope" | "index";
};

function textField(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function pathTitle(path: string) {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

function mappedOwner(owner: unknown) {
  return textField(Array.isArray(owner) ? owner[0] : owner);
}

function productIdOf(value: unknown, kind: BacklogKind) {
  return isBacklogId(value) && value.startsWith(kind + "-") ? value : undefined;
}

function productIdentity(note: Note, kind: BacklogKind) {
  const { frontmatter: fields } = note;
  const productId = fields["pe-id"];
  const id = productIdOf(productId, kind);
  const decoded = backlogType.decode(note);
  const adopted = decoded.kind === "editable" && id !== undefined && decoded.issues.length === 0;
  const registered = fields.schema !== undefined || fields.id !== undefined;
  const conflict = (productId !== undefined && !id) || (registered && !adopted);
  return {
    ...(id && { id }),
    conflict,
    adopted,
  };
}

function item(note: Note): BacklogItem | undefined {
  const { path, frontmatter: fields } = note;
  const kind = backlogKind(fields.type);
  if (!kind) return;
  return {
    key: path,
    ...productIdentity(note, kind),
    kind,
    path,
    fields,
    title: textField(fields.title) || pathTitle(path),
    state: "",
    priority: "",
    owner: "",
    brokenParent: false,
    ...(typeof fields.order === "number" &&
      Number.isFinite(fields.order) && { rank: fields.order }),
  };
}

export function backlogLink(path: string) {
  return "[[" + path.replace(/\.md$/i, "") + "]]";
}

export function rawLink(value: unknown) {
  return typeof value === "string"
    ? /^\[\[([^|#\]]+)(?:\|[^\]]+)?\]\]$/.exec(value.trim())?.[1]
    : undefined;
}

function pathParts(notePath: string) {
  const last = notePath.lastIndexOf("/");
  return { directory: notePath.slice(0, last + 1), name: notePath.slice(last + 1) };
}

function linkedParent(child: BacklogItem, eligible: readonly BacklogItem[]) {
  const link = rawLink(child.fields.parent);
  if (!link) return;
  const path = clashKey(link.replace(/\.md$/i, ""));
  const target = clashKey(pathParts(child.path).directory) + path;
  const exact = eligible.find(
    ({ path: candidate }) => clashKey(candidate.replace(/\.md$/i, "")) === path,
  );
  if (exact) return exact;
  const relative = eligible.find(
    ({ path: candidate }) => clashKey(candidate.replace(/\.md$/i, "")) === target,
  );
  if (relative) return relative;
  if (path.includes("/")) return;
  const matching = eligible.filter(
    ({ path: candidate }) => clashKey(pathTitle(candidate)) === path,
  );
  return matching.length === 1 ? matching[0] : undefined;
}

export function compareRank(left: BacklogItem, right: BacklogItem) {
  return (left.rank ?? Infinity) - (right.rank ?? Infinity) || left.path.localeCompare(right.path);
}

export function inBacklog(
  note: Note,
  project: Project,
  base: BacklogBase,
  others: readonly Project[],
) {
  return (
    base.includes(note.path, note.frontmatter) &&
    (note.frontmatter.project_id === undefined || note.frontmatter.project_id === project.id) &&
    !others.some(
      ({ id, folder }) =>
        id !== project.id &&
        folder &&
        foldWithin(folder, project.folder) &&
        isInFolder(note.path, folder),
    )
  );
}

function foldWithin(folder: string, root: string) {
  return clashKey(folder) === clashKey(root) || isInFolder(folder, root);
}

export function backlogItems(
  project: Project,
  base: BacklogBase,
  notes: readonly Note[],
  others: readonly Project[],
) {
  const items = notes.flatMap((note) => {
    const row = inBacklog(note, project, base, others) ? item(note) : undefined;
    return row ? [row] : [];
  });
  const counts = new Map<string, number>();
  for (const { id } of items) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .toSorted();
  const keyed = items.map((row) => {
    const duplicate = row.id !== undefined && duplicates.includes(row.id);
    return {
      ...row,
      state: textField(row.fields[base.state]),
      owner: mappedOwner(row.fields[base.owner]),
      priority: textField(row.fields[base.priority]),
      conflict: row.conflict || duplicate,
      key: row.id && !duplicate ? row.id : row.path,
    };
  });
  return {
    duplicates,
    items: keyed
      .map((row): BacklogItem => {
        const parent = linkedParent(row, keyed);
        const required = parentKind(row.kind);
        const matched = parent && parent.kind === required ? parent.key : undefined;
        return {
          ...row,
          ...(matched && { parent: matched }),
          brokenParent: required ? !matched : !!row.fields.parent,
        };
      })
      .toSorted(compareRank),
  };
}
