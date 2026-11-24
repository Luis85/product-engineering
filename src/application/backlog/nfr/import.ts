import { Effect } from "effect";
import { nfrTitleKey, previewNfrCsv } from "../../../domain/backlog";
import type { NfrCsvPreview, NfrId } from "../../../domain/backlog";
import { sameFrontmatterValue } from "../../../domain/notes";
import type { ProjectId } from "../../projects";
import { NfrError } from "./model";
import type { NfrImportPlan, NfrImportResult } from "./model";
import { createNfrNote, newNfrId, withNfrWrite, writableNfrCatalog } from "./storage";

type Catalog = Effect.Success<ReturnType<typeof writableNfrCatalog>>;

function previewFor(projectId: ProjectId, source: string, catalog: Catalog): NfrCsvPreview {
  const preview = previewNfrCsv(source, catalog.records, catalog.members);
  const invalid = new Set(
    catalog.decoded.flatMap(({ path, values, frontmatter }) =>
      frontmatter.project_id === projectId &&
      values.title &&
      catalog.invalid.some((item) => item.path === path)
        ? [nfrTitleKey(values.title)]
        : [],
    ),
  );
  if (!invalid.size) return preview;
  const issues = [...preview.issues];
  const rows = preview.rows.map((row) => {
    if (row.status === "invalid" || !invalid.has(nfrTitleKey(row.values.title))) return row;
    issues.push({ line: row.line, code: "conflict" });
    return { ...row, status: "invalid" as const };
  });
  return { rows, issues: issues.toSorted((a, b) => a.line - b.line) };
}

export function planNfrImport(projectId: ProjectId, source: string) {
  return Effect.gen(function* () {
    const catalog = yield* writableNfrCatalog(projectId);
    const preview = previewFor(projectId, source, catalog);
    const identities = new Map<number, NfrId>();
    if (!preview.issues.length) {
      for (const { status, line } of preview.rows) {
        if (status === "new") identities.set(line, yield* newNfrId);
      }
    }
    return { projectId, source, preview, identities } satisfies NfrImportPlan;
  });
}

function compatible(plan: NfrImportPlan, current: NfrCsvPreview) {
  const checked = new Map(plan.preview.rows.map((row) => [row.line, row]));
  return current.rows.every((row) => {
    const previous = checked.get(row.line);
    return (
      previous !== undefined &&
      sameFrontmatterValue(row.values, previous.values) &&
      (row.status === "skip" || plan.identities.has(row.line))
    );
  });
}

export function confirmNfrImport(projectId: ProjectId, source: string, plan: NfrImportPlan) {
  return withNfrWrite(
    Effect.gen(function* () {
      if (projectId !== plan.projectId || source !== plan.source || plan.preview.issues.length)
        return yield* new NfrError({ reason: "stale" });
      const catalog = yield* writableNfrCatalog(projectId);
      const preview = previewFor(projectId, source, catalog);
      if (preview.issues.length || !compatible(plan, preview))
        return { state: "changed", preview } satisfies NfrImportResult;
      let created = 0;
      for (const row of preview.rows) {
        if (row.status !== "new") continue;
        const id = plan.identities.get(row.line);
        if (!id) return yield* new NfrError({ reason: "stale" });
        // Previously saved rows are recognized on retry. Never remove a note another leaf could have edited.
        yield* createNfrNote(catalog.store, catalog.project, id, row.values);
        created++;
      }
      return {
        state: "saved",
        created,
        skipped: preview.rows.length - created,
      } satisfies NfrImportResult;
    }),
  );
}
