import { it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import { expect } from "vitest";
import { memoryNoteStore } from "../../../../src/infrastructure/memory/notes";
import { run, sampleFrontmatter } from "../../../support/notes/fixture";

function fixture() {
  const adapter = memoryNoteStore();
  return { ...adapter, body: (path: string) => Effect.sync(() => adapter.body(path)) };
}

it.effect("keeps failure values and defects distinct from a rejected vault write", () => {
  const notes = fixture();
  return run(notes, (store) =>
    Effect.gen(function* () {
      const path = "Record.md";
      yield* notes.seed(path, sampleFrontmatter, "The body\n");
      const before = yield* store.read(path);
      const error = { _tag: "CustomConflict" } as const;
      expect(yield* Effect.flip(store.update(path, () => Result.fail(error)))).toBe(error);
      const exit = yield* Effect.exit(
        store.update(path, () => {
          throw new Error("callback defect");
        }),
      );
      expect(Exit.hasDies(exit)).toBe(true);
      expect(yield* store.read(path)).toEqual(before);
      expect(yield* notes.body(path)).toBe("The body\n");
    }),
  );
});

it.effect("gives a patch callback a copy of the current properties", () => {
  const notes = fixture();
  return run(notes, (store) =>
    Effect.gen(function* () {
      const path = "Record.md";
      yield* notes.seed(path, { ...sampleFrontmatter, flags: ["first"] });
      const note = yield* store.update(path, (current) => {
        if (Array.isArray(current.flags)) current.flags.push("attempted mutation");
        return Result.succeed({});
      });
      expect(note.frontmatter.flags).toEqual(["first"]);
      expect(yield* store.read(path)).toEqual(note);
    }),
  );
});
