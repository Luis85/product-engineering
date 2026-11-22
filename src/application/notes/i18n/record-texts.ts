import type { NoteIssue } from "../../../domain/notes";
import type { NotesCatalog } from "./catalog";
import { describeNoteIssue } from "./describe";

type IssueWithCode<Issue, Code> = Issue extends { code: infer Codes }
  ? Code extends Codes
    ? Issue & { readonly code: Code }
    : never
  : never;

export type IssueSentences<Issue extends NoteIssue> = {
  readonly [Code in Issue["code"]]?: (issue: IssueWithCode<Issue, Code>) => string;
};

export type RecordTexts<Issue extends NoteIssue> = {
  readonly fields: Readonly<Record<string, string>>;
  readonly missing?: Readonly<Record<string, string>>;
  readonly issues: IssueSentences<Issue>;
};

function ownText(map: Readonly<Record<string, string>> | undefined, key: string) {
  return map && Object.hasOwn(map, key) ? map[key] : undefined;
}

export function describeRecordIssue<Issue extends NoteIssue>(
  issue: Issue,
  notes: NotesCatalog,
  texts: RecordTexts<Issue>,
): string {
  if (Object.hasOwn(texts.issues, issue.code)) {
    // The issue's code selects the matching sentence.
    const describe = texts.issues[issue.code as Issue["code"]] as
      ((issue: Issue) => string) | undefined;
    if (describe) return describe(issue);
  }
  const missing =
    issue.code === "field.missing" && "key" in issue
      ? ownText(texts.missing, issue.key)
      : undefined;
  return missing ?? describeNoteIssue(issue, notes, (key) => ownText(texts.fields, key) ?? key);
}
