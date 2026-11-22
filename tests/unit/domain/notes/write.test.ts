import { Result } from "effect";
import { describe, expect, it } from "vitest";
import {
  checkbox,
  defineNoteType,
  list,
  number,
  schemaMarker,
  text,
} from "../../../../src/domain/notes";

const type = defineNoteType({
  type: "merge-test",
  version: 3,
  fields: {
    title: text(),
    count: number(),
    done: checkbox(),
    tags: list(),
    owner: text(),
    constructor: text(),
  },
  migrations: {
    1: ({ old_title, ...raw }) => ({ ...raw, title: old_title, id: "changed-by-migration" }),
    2: (raw) => {
      if (raw.bad_migration) throw Error("migration failed");
      return { ...raw, count: raw.count ?? 0 };
    },
    3: () => {
      throw Error("happily ignored");
    },
  },
});

const identity = {
  schema: schemaMarker(type.type, 3),
  id: "merge-test-00000000-0000-0000-0000-000000000001",
};

describe("merging a record edit", () => {
  it("writes changed fields, removes cleared properties and preserves unrelated external edits", () => {
    const base = { ...identity, title: "Base", count: 2, done: false, tags: ["same"], owner: null };
    const edited = {
      title: "Changed",
      count: undefined,
      done: false,
      tags: ["same"],
      owner: undefined,
    };
    const current = { ...base, done: true, owner: "New owner", unknown: "External" };

    expect(type.merge(base, edited, current)).toEqual(
      Result.succeed({ set: { title: "Changed" }, remove: ["count"] }),
    );
  });

  it("accepts equal concurrent edits and keeps null or broken properties left untouched", () => {
    const base = { ...identity, title: 42, tags: ["one"], owner: null, extra: [1] };
    const edited = { title: undefined, tags: ["one", "two"], owner: undefined, extra: [2] };
    const current = { ...base, tags: ["one", "two"] };

    expect(type.merge(base, edited, current)).toEqual(Result.succeed({}));
    expect(type.merge(base, { ...edited, title: "Repaired" }, current)).toEqual(
      Result.succeed({ set: { title: "Repaired" } }),
    );
  });

  it("ignores inherited field values when comparing a declared property", () => {
    const base = { ...identity, constructor: "Before" };
    const edited = {};
    const current = { ...base };
    expect(type.merge(base, edited, current)).toEqual(Result.succeed({ remove: ["constructor"] }));
  });

  it("reports every conflicted field and returns no patch", () => {
    const base = { ...identity, title: "Base", count: null, done: false, tags: ["one"] };
    const edited = { title: "Typed", count: 1, done: true, tags: undefined };
    const current = { ...base, title: "External", count: 0, tags: ["two"] };

    expect(type.merge(base, edited, current)).toEqual(
      Result.fail({
        kind: "conflict",
        conflicts: [
          { key: "title", base: "Base", edited: "Typed", current: "External" },
          { key: "count", base: undefined, edited: 1, current: 0 },
          { key: "tags", base: ["one"], edited: undefined, current: ["two"] },
        ],
      }),
    );
  });

  it("merges the fresh migrated record and persists migration changes with the original id", () => {
    const base = {
      ...identity,
      schema: schemaMarker(type.type, 1),
      old_title: "Base",
      owner: "Initial",
      extra: "old",
    };
    const edited = { title: "Edited", count: 0, owner: "Initial" };
    const current = { ...base, owner: "Changed elsewhere", extra: "fresh" };

    expect(type.merge(base, edited, current)).toEqual(
      Result.succeed({
        set: { schema: identity.schema, title: "Edited", count: 0 },
        remove: ["old_title"],
      }),
    );
    expect(type.merge(base, edited, { ...current, old_title: "Independent" })).toEqual(
      Result.fail({
        kind: "conflict",
        conflicts: [{ key: "title", base: "Base", edited: "Edited", current: "Independent" }],
      }),
    );
  });

  it.each([
    ["other-type", { schema: schemaMarker("another-type", 1) }],
    ["other-type", { schema: null }],
    ["newer-version", { schema: schemaMarker(type.type, 4) }],
    ["identity", { id: null }],
    ["identity", { id: "merge-test-00000000-0000-0000-0000-000000000002" }],
    ["migration-failed", { schema: schemaMarker(type.type, 2), bad_migration: true }],
  ])("refuses stale edits when the current record has %s", (reason, change) => {
    expect(type.merge(identity, { title: "Typed" }, { ...identity, ...change })).toEqual(
      Result.fail({ kind: "refused", reason }),
    );
  });
});
