import type { ProjectMemberId } from "../../projects";
import { matchNfrCategory, nfrKey } from "./categories";
import type { NfrCategory } from "./categories";
import { parseNfrRows } from "./csv-rows";
import { checkNfrDraft } from "./record";
import type { NfrDraft, NfrInputIssue } from "./record";

export const nfrCsvHeaders = [
  "Titel",
  "Anforderung",
  "Abnahmekriterium",
  "Verantwortlich",
  "Kategorien",
] as const;
export type NfrCsvIssue = {
  readonly line: number;
  readonly code:
    | NfrInputIssue
    | "header"
    | "header-missing"
    | "rows-missing"
    | "quote"
    | "quote-tail"
    | "quote-open"
    | "columns"
    | "conflict"
    | "category-empty";
  readonly value?: string;
};
type CsvRow = {
  readonly line: number;
  readonly status: "new" | "skip" | "invalid";
  readonly values: NfrDraft;
};
export type NfrCsvPreview = {
  readonly rows: readonly CsvRow[];
  readonly issues: readonly NfrCsvIssue[];
};
type Member = { readonly id: ProjectMemberId; readonly name: string };
type TitleSignatures = Map<string, Set<string>>;

function signatures(values: readonly NfrDraft[]): TitleSignatures {
  const result: TitleSignatures = new Map();
  for (const row of values) {
    const key = nfrKey(row.title);
    const found = result.get(key) ?? new Set<string>();
    found.add(signature(row));
    result.set(key, found);
  }
  return result;
}

const normalizedContent = (value: string) => value.trim().replace(/\r\n?/g, "\n");

function signature({ requirement, acceptance, owner_id, categories }: NfrDraft) {
  return JSON.stringify([
    normalizedContent(requirement),
    normalizedContent(acceptance),
    owner_id,
    [...new Set(categories)].toSorted(),
  ]);
}

type Report = (code: NfrCsvIssue["code"], token?: string) => void;

function csvCategories(source: string, report: Report) {
  const categories = new Set<NfrCategory>();
  if (source)
    for (const chunk of source.split("|")) {
      const token = chunk.trim();
      const category = matchNfrCategory(token);
      if (category) categories.add(category);
      else if (token) report("category", token);
      else report("category-empty");
    }
  return [...categories];
}

function csvOwner(source: string, members: readonly Member[]) {
  if (!source) return;
  const byId = members.find(({ id }) => id === source);
  if (byId) return byId.id;
  const names = members.filter(({ name }) => nfrKey(name) === nfrKey(source));
  return names.length === 1 ? names[0]?.id : undefined;
}

function orderedCells(row: readonly string[], indexes: readonly number[]) {
  return indexes.map((index) => row[index]?.trim() ?? "") as [
    string,
    string,
    string,
    string,
    string,
  ];
}

function previewRow(
  row: ReturnType<typeof parseNfrRows>[number],
  indexes: readonly number[],
  existing: TitleSignatures,
  members: readonly Member[],
  issues: NfrCsvIssue[],
): CsvRow {
  const [title, requirement, acceptance, owner, tags] = orderedCells(row.cells, indexes);
  const draft: NfrDraft = { title, requirement, acceptance, categories: [] };
  const invalid = (code: NfrCsvIssue["code"]): CsvRow => {
    issues.push({ line: row.line, code });
    return { line: row.line, values: draft, status: "invalid" };
  };
  if (row.issue) return invalid(row.issue);
  if (row.cells.length !== indexes.length) return invalid("columns");
  const before = issues.length;
  const report: Report = (code, value) =>
    issues.push({ line: row.line, code, ...(value !== undefined && { value }) });
  for (const issue of checkNfrDraft(draft)) report(issue);
  const owner_id = csvOwner(owner, members);
  if (owner && !owner_id) report("owner", owner);
  const values = {
    ...draft,
    ...(owner_id && { owner_id }),
    categories: csvCategories(tags, report),
  };
  const status = issues.length === before ? compareRow(values, existing, report) : "invalid";
  return { line: row.line, values, status };
}

function compareRow(values: NfrDraft, existing: TitleSignatures, report: Report): CsvRow["status"] {
  const key = nfrKey(values.title);
  const mark = signature(values);
  const matches = existing.get(key);
  if (!matches) {
    existing.set(key, new Set([mark]));
    return "new";
  }
  if (matches.size === 1 && matches.has(mark)) return "skip";
  report("conflict");
  return "invalid";
}

export function previewNfrCsv(
  source: string,
  existing: readonly NfrDraft[],
  members: readonly Member[],
): NfrCsvPreview {
  const [header, ...rows] = parseNfrRows(source);
  const noRows = (line: number, code: NfrCsvIssue["code"]) => ({
    rows: [],
    issues: [{ line, code }],
  });
  if (!header) return noRows(1, "header-missing");
  if (header.issue) return noRows(header.line, header.issue);
  const labels = header.cells.map(nfrKey);
  const indexes = nfrCsvHeaders.map((name) => labels.indexOf(nfrKey(name)));
  if (labels.length !== indexes.length || indexes.includes(-1))
    return noRows(header.line, "header");
  if (!rows.length) return noRows(header.line, "rows-missing");
  const byTitle = signatures(existing);
  const issues: NfrCsvIssue[] = [];
  return { rows: rows.map((row) => previewRow(row, indexes, byTitle, members, issues)), issues };
}
