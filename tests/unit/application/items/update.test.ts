import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { expect } from "vitest";
import { deleteItem, itemList, updateItem } from "../../../../src/application/items";
import { NoteStore } from "../../../../src/application/notes";
import { clashName, MAX_NAME_ATTEMPTS } from "../../../../src/domain/notes";
import { itemFixture, itemRecord } from "../../../support/items/fixture";

const path = "Project/Items/Old title.md";
const indexedItem = itemList.pipe(
  Effect.map(({ rows }) => {
    const row = rows.find((entry) => entry.path === path);
    if (!row) throw new Error("Expected the test item");
    return row;
  }),
);

it.effect("repairs an item and renames a following file around a taken basename", () => {
  const fixture = itemFixture();
  return Effect.gen(function* () {
    yield* fixture.notes.seed(
      path,
      itemRecord("Old title", 10, { status: "legacy", other: "keep" }),
      "Body\n",
    );
    yield* fixture.notes.seed("Project/Items/New title.md", "none");
    yield* fixture.ready;
    const row = yield* indexedItem;
    expect(row.issues).toEqual([{ key: "status", code: "status.unknown" }]);
    const saved = yield* updateItem(row, { title: "  New title  ", status: "done" });
    expect(saved.path).toBe("Project/Items/New title (2).md");
    expect(saved.frontmatter).toEqual(
      itemRecord("New title", 10, { status: "done", other: "keep" }),
    );
    expect(fixture.notes.body(saved.path)).toBe("Body\n");
    expect((yield* fixture.indexed).rows.map(({ path: current }) => current)).toEqual([saved.path]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect(
  "follows an external rename by ID and preserves a loaded title that fails new filename rules",
  () => {
    const fixture = itemFixture();
    return Effect.gen(function* () {
      const title = " " + "界".repeat(98) + " ";
      yield* fixture.notes.seed(path, itemRecord(title, 10, { due: "2026-12-01" }));
      yield* fixture.ready;
      const row = yield* indexedItem;
      const noteStore = yield* NoteStore;
      const renamed = yield* noteStore.rename(path, "Manually named");
      yield* fixture.notes.seed("Outside/Copy title.md", itemRecord(title, 11));
      yield* noteStore.update(renamed.path, () => Result.succeed({ set: { other: "external" } }));

      const saved = yield* updateItem(row, { title, status: "done", due: "" });
      expect(saved.path).toBe(renamed.path);
      expect(saved.frontmatter).toEqual(
        itemRecord(title, 10, { status: "done", other: "external" }),
      );
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("refuses update and delete when a second note picked up the item ID", () => {
  const fixture = itemFixture();
  return Effect.gen(function* () {
    const original = itemRecord("Old title", 10);
    yield* fixture.notes.seed(path, original);
    yield* fixture.ready;
    const row = yield* indexedItem;
    yield* fixture.notes.seed("Outside/Copy id.md", { ...original, title: "Copy" });
    const update = yield* Effect.flip(updateItem(row, { title: "Allowed title", status: "done" }));
    const remove = yield* Effect.flip(deleteItem(row));
    expect(update).toMatchObject({ _tag: "NoteWriteRefusedError", reason: "duplicate-id" });
    expect(remove).toMatchObject({ _tag: "NoteWriteRefusedError", reason: "duplicate-id" });
    expect((yield* fixture.stored(path)).frontmatter).toEqual(original);
    expect(fixture.notifier).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect(
  "keeps the saved note and logs the item rename event when every candidate is taken",
  () => {
    const fixture = itemFixture();
    return Effect.gen(function* () {
      yield* fixture.notes.seed(path, itemRecord("Old title", 10));
      for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
        yield* fixture.notes.seed(`Project/Items/${clashName("New title", attempt)}.md`, "none");
      }
      yield* fixture.ready;
      const row = yield* indexedItem;
      const saved = yield* updateItem(row, { title: "New title", status: "open" });
      expect(saved).toEqual({ path, frontmatter: itemRecord("New title", 10) });
      const logs = fixture.logger.filter(({ event }) => event === "items.rename.failed");
      const timestamp = logs[0]?.timestamp;
      expect(timestamp).toBeTypeOf("number");
      expect(logs).toEqual([{ level: "warn", event: "items.rename.failed", timestamp }]);
    }).pipe(Effect.provide(fixture.layer));
  },
);
