import { boardStages } from "../../domain/backlog";
import type { ProjectId } from "../../domain/projects";
import { isInFolder } from "../notes";
import { backlogFilter } from "./ports";

export type BacklogBase = {
  readonly folder: string;
  readonly state: string;
  readonly owner: string;
  readonly priority: string;
  readonly states: readonly string[];
  readonly priorities: readonly string[];
  readonly includes: (path: string, fields: Readonly<Record<string, unknown>>) => boolean;
};

type BaseFilters = {
  readonly folder: string;
  readonly excludes: readonly string[];
  readonly projectOnly: boolean;
};

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function clauses(value: unknown): readonly string[] | undefined {
  const group = object(value);
  const and: unknown = group?.and;
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  if (
    group &&
    Object.keys(group).length === 1 &&
    Array.isArray(and) &&
    and.every((entry) => typeof entry === "string")
  )
    return and;
}

function validFolder(value: string) {
  return !!value && value.split("/").every((part) => part && part !== "." && part !== "..");
}

function parseClause(raw: string, project: ProjectId) {
  const expression = raw.trim();
  if (expression === backlogFilter(project)) return { kind: "project" } as const;
  if (/^file\.ext\s*==\s*(["'])md\1$/.test(expression)) return { kind: "markdown" } as const;
  const folder = /^file\.inFolder\((["'])([^"'\\]+)\1\)$/.exec(expression)?.[2]?.replace(/\/$/, "");
  if (folder && validFolder(folder)) return { kind: "folder", folder } as const;
  const name = /^file\.name\s*!=\s*(["'])([^"'\\]+)\1$/.exec(expression)?.[2];
  if (name) return { kind: "exclude", name } as const;
}

function filters(expressions: readonly string[], projectFolder: string, project: ProjectId) {
  const parsed = expressions.map((expression) => parseClause(expression, project));
  if (parsed.some((entry) => !entry)) return;
  const folders = new Set(
    parsed.flatMap((entry) => (entry?.kind === "folder" ? [entry.folder] : [])),
  );
  if (folders.size > 1) return;
  const folder = folders.values().next().value;
  const projectOnly = parsed.some((entry) => entry?.kind === "project");
  if (!projectOnly && (!projectFolder || !folder)) return;
  const scope = folder ?? projectFolder;
  if (scope !== projectFolder && !isInFolder(scope, projectFolder)) return;
  const excludes = parsed.flatMap((entry) => (entry?.kind === "exclude" ? [entry.name] : []));
  return { folder: scope, excludes, projectOnly } satisfies BaseFilters;
}

function property(value: unknown, fallback: string) {
  if (value === undefined) return fallback;
  return typeof value === "string"
    ? /^note\.([\p{L}\p{N}_ -]{1,80})$/u.exec(value)?.[1]
    : undefined;
}

function choices(value: unknown, fallback: readonly string[]) {
  if (value === undefined) return fallback;
  const parts: readonly unknown[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [
    ...new Set(
      parts.flatMap((entry) => (typeof entry === "string" && entry.trim() ? [entry.trim()] : [])),
    ),
  ];
}

const reserved = new Set([
  "schema",
  "id",
  "title",
  "type",
  "parent",
  "order",
  "pbl-id",
  "pe-id",
  "project_id",
  "pbi_stage_choice",
  "__proto__",
  "constructor",
  "prototype",
]);

function fieldsOf(view: Record<string, unknown>) {
  const { stateProperty, assigneeProperty, priorityProperty, stateValues, priorityValues } = view;
  const state = property(stateProperty, "status");
  const owner = property(assigneeProperty, "assignee");
  const priority = property(priorityProperty, "priority");
  if (!state || !owner || !priority) return;
  const properties = [state, owner, priority].map((key) => key.toLowerCase());
  if (new Set(properties).size !== 3 || properties.some((key) => reserved.has(key))) return;
  return {
    state,
    owner,
    priority,
    states: choices(stateValues, boardStages),
    priorities: choices(priorityValues, ["P1", "P2", "P3"]),
  };
}

function baseView(views: unknown) {
  if (!Array.isArray(views)) return;
  const supported = views.map(object);
  return (
    supported.find((entry) => entry?.type === "product-backlog") ??
    supported.find((entry) => entry?.type === "table")
  );
}

export function backlogConfiguration(
  value: unknown,
  path: string,
  project: ProjectId,
): BacklogBase | undefined {
  const base = object(value);
  const view = baseView(base?.views);
  if (!view) return;
  const global = clauses(base?.filters);
  const local = clauses(view.filters);
  if (!global || !local) return;
  const scope = filters(
    [...global, ...local],
    path.slice(0, Math.max(path.lastIndexOf("/"), 0)),
    project,
  );
  if (!scope || (view.homeFolder !== undefined && view.homeFolder !== scope.folder)) return;
  const mapped = fieldsOf(view);
  if (!mapped) return;
  return {
    ...mapped,
    folder: scope.folder,
    includes: (note, fields) =>
      isInFolder(note, scope.folder) &&
      (!scope.projectOnly || fields.project_id === project) &&
      !scope.excludes.includes(note.slice(note.lastIndexOf("/") + 1).replace(/\.md$/i, "")),
  };
}
