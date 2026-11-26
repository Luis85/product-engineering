import { Result } from "effect";
import * as fc from "fast-check";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { editChange } from "../../../../src/application/notes";
import { updateNoteText } from "../../../../src/application/notes/adapter";
import { markDuplicateIds, newNoteText, schemaMarker } from "../../../../src/domain/notes";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const recordPath = "Records/Example.md";
const coreRecord = {
  schema: schemaMarker(testNoteType.type, testNoteType.version),
  id: TEST_RECORD_ID,
  title: "Original",
};

const atom = fc.oneof(fc.string(), fc.boolean(), fc.integer(), fc.constant(null));
const extraProperties = fc.dictionary(
  fc.stringMatching(/^extra_[a-z0-9_]{1,8}$/),
  fc.oneof(atom, fc.array(fc.string(), { maxLength: 5 })),
  { maxKeys: 8 },
);

it("always decodes arbitrary frontmatter and preserves the input snapshot", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.anything(),
        fc.record({
          schema: fc.constant(coreRecord.schema),
          id: fc.constant(coreRecord.id),
          title: fc.anything(),
          points: fc.anything(),
        }),
      ),
      (frontmatter) => {
        const decoded = testNoteType.decode({ path: recordPath, frontmatter });
        expect(decoded.path).toBe(recordPath);
        expect(decoded.frontmatter).toBe(frontmatter);
      },
    ),
    { numRuns: 300 },
  );
});

it("round-trips a record edit with untouched unknown values and original property order", () => {
  fc.assert(
    fc.property(extraProperties, fc.string(), (extra, title) => {
      const original = { ...coreRecord, ...extra, points: 4 };
      const expected = { ...original, title };
      const before = newNoteText(original, "# Body\n");
      const result = updateNoteText(
        before,
        editChange(testNoteType, original, { title, points: 4 }),
        parse,
      );
      if (Result.isFailure(result)) throw result.failure;
      expect(result.success.frontmatter).toEqual(expected);
      expect(Object.keys(result.success.frontmatter)).toEqual(Object.keys(original));
      expect(result.success.text).toBe(newNoteText(expected, "# Body\n"));
    }),
    { numRuns: 250 },
  );
});

it("produces no edit for unreadable YAML or a newer schema and flags duplicate IDs", () => {
  const change = editChange(testNoteType, coreRecord, { title: "Edited" });
  const brokenYaml = updateNoteText("---\ntitle: [\n---\n", change, parse);
  expect(Result.isFailure(brokenYaml) && brokenYaml.failure).toMatchObject({
    _tag: "NoteUnreadableError",
  });

  const newer = {
    ...coreRecord,
    schema: schemaMarker(testNoteType.type, testNoteType.version + 1),
  };
  const decoded = testNoteType.decode({ path: recordPath, frontmatter: newer });
  expect(decoded).toMatchObject({ kind: "read-only", issue: { code: "schema.newer" } });
  const newerYaml = updateNoteText(newNoteText(newer), change, parse);
  expect(Result.isFailure(newerYaml) && newerYaml.failure).toMatchObject({
    _tag: "NoteWriteRefusedError",
    reason: "newer-version",
  });

  const copy = "Records/Copy.md";
  const duplicates = markDuplicateIds([
    testNoteType.decode({ path: recordPath, frontmatter: coreRecord }),
    testNoteType.decode({ path: copy, frontmatter: { ...coreRecord } }),
  ]);
  expect(duplicates).toMatchObject([
    { kind: "read-only", issue: { code: "id.duplicate", other: copy } },
    { kind: "read-only", issue: { code: "id.duplicate", other: recordPath } },
  ]);
});
