import type { ProjectId } from "../../domain/projects";
import { isProjectRecordIdentifier, PROJECT_RECORD } from "./routes";
import type { ProjectReference } from "./routes";

type ScopedRoute = {
  readonly name: string;
  readonly projectId: ProjectId;
  readonly reference?: Pick<ProjectReference, "kind" | "recordId">;
};

export type ProjectSearchRecord<R extends ScopedRoute = ScopedRoute> = ProjectReference & {
  readonly title: string;
  readonly displayId?: string;
  readonly notePath?: string;
  readonly route: R;
};

export type ProjectSearchContributor<R extends ScopedRoute = ScopedRoute> = (
  projectId: ProjectId,
) => readonly ProjectSearchRecord<R>[];

const normalized = (value: string) => value.normalize("NFKC").toLowerCase();
const referenceKey = ({ kind, recordId }: ProjectReference) => JSON.stringify([kind, recordId]);

export function projectSearchMatches(query: string, ...fields: readonly (string | undefined)[]) {
  const search = normalized(query.trim());
  return (
    search === "" ||
    fields.some((field) => field !== undefined && normalized(field).includes(search))
  );
}

function scopedRecords<R extends ScopedRoute>(
  id: ProjectId,
  contributors: readonly ProjectSearchContributor<R>[],
) {
  return contributors
    .flatMap((contribute) => contribute(id))
    .filter(
      (record) =>
        record.projectId === id &&
        record.route.projectId === id &&
        isProjectRecordIdentifier(record) &&
        routeMatches(record),
    );
}

function routeMatches({ route, kind, recordId }: ProjectSearchRecord) {
  return (
    route.name !== PROJECT_RECORD ||
    (route.reference?.kind === kind && route.reference.recordId === recordId)
  );
}

export function resolveProjectReference<R extends ScopedRoute>(
  { projectId, kind, recordId }: ProjectReference,
  contributors: readonly ProjectSearchContributor<R>[],
) {
  const matches = scopedRecords(projectId, contributors).filter(
    (record) => record.kind === kind && record.recordId === recordId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function searchProjectRecords<R extends ScopedRoute>(
  id: ProjectId,
  query: string,
  contributors: readonly ProjectSearchContributor<R>[],
) {
  const records = scopedRecords(id, contributors);
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = referenceKey(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return records.filter(
    (record) =>
      counts.get(referenceKey(record)) === 1 &&
      projectSearchMatches(query, record.title, record.recordId, record.displayId),
  );
}
