import { expect, it } from "vitest";
import {
  describeNoteIssue,
  NoteEditConflictError,
  notesModule,
} from "../../../../src/application/notes";
import { toLoggedError } from "../../../../src/application/shell";
import type { NoteIssue } from "../../../../src/domain/notes";

const fieldIssues = [
  "field.text",
  "field.number",
  "field.checkbox",
  "field.date",
  "field.list",
  "field.missing",
  "test.short-title",
].map((code) => ({ code, key: "title" }));

const recordIssues: readonly NoteIssue[] = [
  { code: "id.missing" },
  { code: "id.malformed" },
  { code: "id.other-type" },
  { code: "id.duplicate", other: "Other/Note.md" },
  { code: "schema.newer", version: 7 },
  { code: "migration.failed", version: 2 },
];

it.each(["en", "de"] as const)("words each field and record issue in %s", (language) => {
  const catalog = notesModule.catalog[language];
  const label = (key: string) => {
    expect(key).toBe("title");
    return language === "en" ? "Example title" : "Beispieltitel";
  };
  for (const issue of fieldIssues) {
    expect(describeNoteIssue(issue, catalog, label)).toContain(label(issue.key));
  }
  const recordText = recordIssues.map((issue) => describeNoteIssue(issue, catalog, label));
  expect(recordText.every((text) => text.length > 0)).toBe(true);
  expect(recordText[3]).toContain("Other/Note.md");
  expect(recordText[4]).toContain("7");
  expect(recordText[5]).toContain("2");
});

it("keeps field conflicts available to the form without writing their values into messages or logs", () => {
  const conflicts = [
    {
      key: "title",
      base: "PRIVATE-BASE",
      edited: "PRIVATE-EDIT",
      current: "PRIVATE-VAULT",
    },
  ];
  const error = new NoteEditConflictError({ conflicts });
  expect(error.conflicts).toEqual(conflicts);
  const en = notesModule.errors.describe(error, notesModule.catalog.en);
  const de = notesModule.errors.describe(error, notesModule.catalog.de);
  expect(en.title).toBe("Changes conflict");
  expect(de.title).toBe("Änderungen stehen im Konflikt");
  expect(JSON.stringify({ en, de, log: toLoggedError(error) })).not.toContain("PRIVATE-");
});
