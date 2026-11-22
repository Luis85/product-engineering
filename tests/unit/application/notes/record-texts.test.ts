import { expect, it } from "vitest";
import { describeRecordIssue, notesModule } from "../../../../src/application/notes";
import type { IssueSentences, RecordTexts } from "../../../../src/application/notes";

type Issue =
  | { code: "title.duplicate"; key: "title"; other: string }
  | { code: "field.missing"; key: "title" }
  | { code: "field.number"; key: "points" }
  | { code: "id.missing" };

const issues: IssueSentences<Issue> = {
  "title.duplicate": ({ other }) => `This example has the same name as ${other}.`,
};

const texts: RecordTexts<Issue> = {
  fields: { title: "Example name", points: "Score" },
  missing: { title: "Name the example." },
  issues,
};

it("uses feature sentences and missing-field copy before the generic notes catalog", () => {
  const notes = notesModule.catalog.en;
  expect(
    describeRecordIssue({ code: "title.duplicate", key: "title", other: "Beta" }, notes, texts),
  ).toBe("This example has the same name as Beta.");
  expect(describeRecordIssue({ code: "field.missing", key: "title" }, notes, texts)).toBe(
    "Name the example.",
  );
  expect(describeRecordIssue({ code: "field.number", key: "points" }, notes, texts)).toContain(
    "Score",
  );
  expect(describeRecordIssue({ code: "id.missing" }, notes, texts)).toBe(
    "The record ID is missing.",
  );
});
