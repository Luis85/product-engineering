import { expect, it, vi } from "vitest";
import { defineNoteType, schemaMarker } from "../../../../src/domain/notes";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const path = "Records/Example.md";
const marker = schemaMarker(testNoteType.type, testNoteType.version);

it.each([
  [undefined, { _tag: "none" }],
  ["product-engineering.test-record/v0", { _tag: "malformed" }],
  ["product-engineering.different/v1", { _tag: "record", type: "different", version: 1 }],
])("returns the marker and raw frontmatter for another note type (%s)", (schema, expected) => {
  const frontmatter = { schema, title: "Paper" };
  expect(testNoteType.decode({ path, frontmatter })).toEqual({
    kind: "not-this-type",
    marker: expected,
    path,
    frontmatter,
  });
});

it("leaves a record with field issues editable and preserves its raw frontmatter", () => {
  const frontmatter = {
    schema: marker,
    id: TEST_RECORD_ID,
    title: "Paper",
    done: "yes",
    due: "2026-11-22",
    tags: ["ready"],
    extension_key: { nested: true },
  };
  const note = testNoteType.decode({ path, frontmatter });

  expect(note).toEqual({
    kind: "editable",
    path,
    frontmatter,
    version: 3,
    id: TEST_RECORD_ID,
    values: { title: "Paper", due: "2026-11-22", tags: ["ready"] },
    issues: [{ key: "done", code: "field.checkbox" }],
  });
  expect(note.frontmatter).toBe(frontmatter);
});

it.each([
  [null, "id.missing"],
  ["broken", "id.malformed"],
  ["different-00000000-0000-0000-0000-000000000001", "id.other-type"],
])("keeps invalid identity %s read-only and retains its valid values", (id, code) => {
  const frontmatter = { schema: marker, id, title: "Paper", points: "one" };

  expect(testNoteType.decode({ path, frontmatter })).toEqual({
    kind: "read-only",
    path,
    frontmatter,
    version: 3,
    issue: { code },
    values: { title: "Paper" },
  });
});

it("leaves newer records read-only with their valid identity and no decoded values", () => {
  const frontmatter = {
    schema: schemaMarker(testNoteType.type, 4),
    id: TEST_RECORD_ID,
    title: "V4",
  };

  expect(testNoteType.decode({ path, frontmatter })).toEqual({
    kind: "read-only",
    path,
    frontmatter,
    version: 4,
    id: TEST_RECORD_ID,
    issue: { code: "schema.newer", version: 4 },
    values: {},
  });
});

it("runs exactly the needed migrations in memory and keeps the file's original version", () => {
  const atCurrent = vi.fn<(value: unknown) => unknown>();
  const afterCurrent = vi.fn<(value: unknown) => unknown>();
  const type = defineNoteType({
    ...testNoteType,
    migrations: { ...testNoteType.migrations, 3: atCurrent, 4: afterCurrent },
  });
  const frontmatter = Object.freeze({
    schema: schemaMarker(type.type, 1),
    id: TEST_RECORD_ID,
    name: "Migrated",
    score: 23,
    done: true,
  });

  expect(type.decode({ path, frontmatter })).toEqual({
    kind: "editable",
    path,
    frontmatter,
    version: 1,
    id: TEST_RECORD_ID,
    values: { title: "Migrated", points: 23, done: true },
    issues: [],
  });
  expect(atCurrent).not.toHaveBeenCalled();
  expect(afterCurrent).not.toHaveBeenCalled();
});

it.each([
  () => {
    throw new Error("Unusable migration");
  },
  () => ["unexpected"],
])("returns the failed migration step without exposing its details", (step) => {
  const type = defineNoteType({
    ...testNoteType,
    migrations: { ...testNoteType.migrations, 2: step },
  });
  const frontmatter = { schema: schemaMarker(type.type, 1), id: TEST_RECORD_ID, title: "Paper" };

  expect(type.decode({ path, frontmatter })).toEqual({
    kind: "read-only",
    path,
    frontmatter,
    version: 1,
    id: TEST_RECORD_ID,
    issue: { code: "migration.failed", version: 2 },
    values: {},
  });
});

it("keeps nested original data and record identity when migration code mutates its input", () => {
  const type = defineNoteType({
    ...testNoteType,
    migrations: {
      2: (raw) => {
        if (Array.isArray(raw.tags)) raw.tags.push("migration");
        return { ...raw, id: "invalid" };
      },
    },
  });
  const frontmatter = {
    schema: schemaMarker(type.type, 2),
    id: TEST_RECORD_ID,
    title: "Paper",
    tags: ["outside"],
  };

  const record = type.decode({ path, frontmatter });
  expect(record).toMatchObject({
    kind: "editable",
    id: TEST_RECORD_ID,
    values: { tags: ["outside", "migration"] },
  });
  expect(frontmatter.tags).toEqual(["outside"]);
});
