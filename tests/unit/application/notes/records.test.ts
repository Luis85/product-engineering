import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { expect } from "vitest";
import {
  editChange,
  IdGenerator,
  newRecordFrontmatter,
  NoteEditConflictError,
  NoteWriteRefusedError,
} from "../../../../src/application/notes";
import { checkbox, defineNoteType, list, number, text } from "../../../../src/domain/notes";

const type = defineNoteType({
  type: "record-test",
  version: 1,
  fields: {
    title: text(),
    done: checkbox(),
    count: number(),
    labels: list(),
    owner: text(),
    constructor: text(),
  },
  migrations: {},
});
const uuid = "00000000-0000-0000-0000-000000000007";
const identity = { schema: "product-engineering.record-test/v1", id: `record-test-${uuid}` };

it.effect("builds fresh frontmatter in the declaration order with one generated id", () =>
  Effect.gen(function* () {
    let draws = 0;
    const frontmatter = yield* newRecordFrontmatter(type, {
      count: 0,
      done: false,
      owner: null,
      title: "",
      labels: [],
      ignored: true,
    }).pipe(
      Effect.provideService(IdGenerator, {
        nextId: Effect.sync(() => {
          draws += 1;
          return uuid;
        }),
      }),
    );
    expect(Object.entries(frontmatter)).toEqual([
      ["schema", identity.schema],
      ["id", identity.id],
      ["title", ""],
      ["done", false],
      ["count", 0],
      ["labels", []],
    ]);
    expect(draws).toBe(1);
    expect(type.decode({ path: "New.md", frontmatter }).kind).toBe("editable");
  }),
);

it("turns merge outcomes into typed results for the atomic write callback", () => {
  const base = { ...identity, title: "Before", labels: ["one"] };
  const change = editChange(type, base, { title: "Edited", labels: ["one"] });

  expect(change({ ...base, labels: ["one", "changed"] })).toEqual(
    Result.succeed({ set: { title: "Edited" } }),
  );
  expect(change({ ...base, title: "External" })).toEqual(
    Result.fail(
      new NoteEditConflictError({
        conflicts: [{ key: "title", base: "Before", edited: "Edited", current: "External" }],
      }),
    ),
  );
  expect(change({ ...base, schema: "product-engineering.record-test/v2" })).toEqual(
    Result.fail(new NoteWriteRefusedError({ reason: "newer-version" })),
  );
});
