import { it } from "@effect/vitest";
import { Effect, Fiber, Result } from "effect";
import { expect } from "vitest";
import { createItem, deleteItem, InvalidItemError } from "../../../../src/application/items";
import { catalogFor } from "../../../../src/application/messages";
import { itemFixture, itemRecord } from "../../../support/items/fixture";

it.effect(
  "creates the ordered record in the configured Items folder, confirms it, and removes it by its row",
  () => {
    const fixture = itemFixture();
    return Effect.gen(function* () {
      yield* fixture.notes.seed("Project/Items/Hallway light.md", "none");
      yield* fixture.ready;
      const saved = yield* createItem({
        title: "  Hallway light  ",
        status: "open",
        due: "2026-12-01",
      });
      expect(saved.path).toBe("Project/Items/Hallway light (2).md");
      expect(saved.frontmatter).toEqual(itemRecord("Hallway light", 1, { due: "2026-12-01" }));
      expect(Object.keys(saved.frontmatter)).toEqual(["schema", "id", "title", "status", "due"]);
      const {
        rows: [row],
      } = yield* fixture.indexed;
      if (!row) throw new Error("Expected the new item");

      yield* deleteItem(row);
      expect((yield* fixture.indexed).rows).toEqual([]);
      expect((yield* Effect.flip(fixture.stored(saved.path)))._tag).toBe("NoteNotFoundError");
      const { notices } = catalogFor("en").notes;
      expect(fixture.notifier).toEqual([
        { severity: "info", title: notices.created("Hallway light"), detail: "" },
        { severity: "info", title: notices.deleted("Hallway light"), detail: "" },
      ]);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect(
  "validates current vault titles before creating, even while the index still has an old snapshot",
  () => {
    const fixture = itemFixture();
    return Effect.gen(function* () {
      yield* fixture.ready;
      yield* fixture.notes.seed("Outside/Title.md", itemRecord("Résumé", 10));
      const duplicate = yield* Effect.flip(
        createItem({ title: "RE\u0301SUME\u0301", status: "open" }),
      );
      const invalid = yield* Effect.flip(
        createItem({ title: "界".repeat(100), status: "open", due: "bad" }),
      );
      expect(duplicate).toBeInstanceOf(InvalidItemError);
      expect(duplicate).toMatchObject({ issues: [{ key: "title", code: "title.taken" }] });
      expect(invalid).toMatchObject({
        issues: [
          { key: "due", code: "field.date" },
          { key: "title", code: "title.too-long" },
        ],
      });
      expect(fixture.notifier).toEqual([]);
      expect((yield* fixture.indexed).rows.map(({ path }) => path)).toEqual(["Outside/Title.md"]);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("serializes concurrent creates so the same title cannot be saved twice", () => {
  const fixture = itemFixture();
  return Effect.gen(function* () {
    yield* fixture.ready;
    fixture.notes.holdWrites();
    const first = yield* Effect.forkChild(createItem({ title: "Meeting", status: "open" }), {
      startImmediately: true,
    });
    const second = yield* Effect.forkChild(
      Effect.result(createItem({ title: "meeting", status: "done" })),
      { startImmediately: true },
    );
    expect(fixture.notes.heldWrites()).toBe(1);
    fixture.notes.releaseWrites();

    expect((yield* Fiber.join(first)).path).toBe("Project/Items/Meeting.md");
    const result = yield* Fiber.join(second);
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "InvalidItemError",
      issues: [{ key: "title", code: "title.taken" }],
    });
    expect((yield* fixture.indexed).rows).toHaveLength(1);
  }).pipe(Effect.provide(fixture.layer));
});
