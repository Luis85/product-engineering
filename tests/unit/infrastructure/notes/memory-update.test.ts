import { Cause, Effect, Exit, Fiber, Result } from "effect";
import { expect, it, vi } from "vitest";
import { NoteStore } from "../../../../src/application/notes";
import type { FrontmatterChange } from "../../../../src/application/notes";
import type { Frontmatter } from "../../../../src/domain/notes";
import { memoryNoteStore } from "../../../../src/infrastructure/memory/notes";
import { eventually } from "../../../support/wait";

it("applies an update to the data present at write time and preserves the body", async () => {
  const fixture = memoryNoteStore();
  await Effect.runPromise(
    Effect.gen(function* () {
      const path = "Edit.md";
      const store = yield* NoteStore;
      const change = vi.fn<
        (before: Frontmatter) => Result.Result<{ set: { name: string }; remove: readonly string[] }>
      >(() => Result.succeed({ set: { name: "Updated" }, remove: ["discard"] }));
      yield* fixture.seed(path, { name: "Original", discard: true }, "Body");
      fixture.holdWrites();
      const writer = yield* Effect.forkChild(store.update(path, change));
      try {
        yield* Effect.promise(() => eventually(() => expect(fixture.heldWrites()).toBe(1)));
        yield* fixture.seed(
          path,
          { name: "External", discard: true, keep: "Preserved" },
          "Updated body",
        );
      } finally {
        fixture.releaseWrites();
      }
      expect(yield* Fiber.join(writer)).toEqual({
        path,
        frontmatter: { name: "Updated", keep: "Preserved" },
      });
      expect(change).toHaveBeenCalledExactlyOnceWith({
        name: "External",
        discard: true,
        keep: "Preserved",
      });
      expect(fixture.body(path)).toBe("Updated body");
    }).pipe(Effect.provide(fixture.layer)),
  );
});

it("retains frontmatter if the change returns a failure or throws a defect", async () => {
  const fixture = memoryNoteStore();
  await Effect.runPromise(
    Effect.gen(function* () {
      const path = "Untouched.md";
      const frontmatter = { name: "Current", tags: ["saved"] };
      const store = yield* NoteStore;
      yield* fixture.seed(path, frontmatter);
      const refused = { reason: "test refusal" };
      const change: FrontmatterChange<typeof refused> = (current) => {
        if (Array.isArray(current.tags)) current.tags.push("never committed");
        return Result.fail(refused);
      };
      expect(yield* Effect.flip(store.update(path, change))).toBe(refused);
      const cause = new Error("Failed edit callback");
      const failed = yield* Effect.exit(
        store.update(path, () => {
          throw cause;
        }),
      );
      if (!Exit.isFailure(failed)) throw new Error("Expected an update defect");
      expect(Cause.squash(failed.cause)).toBe(cause);
      expect(yield* store.read(path)).toEqual({ path, frontmatter });
    }).pipe(Effect.provide(fixture.layer)),
  );
});

it("does not call the change for unreadable or deleted notes", async () => {
  const fixture = memoryNoteStore();
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* NoteStore;
      const change = vi.fn<FrontmatterChange>().mockReturnValue(Result.succeed({}));
      yield* fixture.seed("Unreadable.md", "broken");
      expect(yield* Effect.flip(store.update("Unreadable.md", change))).toMatchObject({
        _tag: "NoteUnreadableError",
      });

      const path = "Removed.md";
      yield* fixture.seed(path, {});
      fixture.holdWrites();
      const pending = yield* Effect.forkChild(Effect.flip(store.update(path, change)));
      try {
        yield* Effect.promise(() => eventually(() => expect(fixture.heldWrites()).toBe(1)));
        yield* fixture.removeOutside(path);
      } finally {
        fixture.releaseWrites();
      }
      expect(yield* Fiber.join(pending)).toMatchObject({ _tag: "NoteNotFoundError" });
      expect(change).not.toHaveBeenCalled();
    }).pipe(Effect.provide(fixture.layer)),
  );
});
