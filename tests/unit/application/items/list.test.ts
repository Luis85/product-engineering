import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { itemList, shownItemName } from "../../../../src/application/items";
import { itemFixture, itemRecord } from "../../../support/items/fixture";

it.effect(
  "reads records from the index with duplicate titles, file-name fallback, and code-unit path ties",
  () => {
    const fixture = itemFixture();
    return Effect.gen(function* () {
      expect(yield* itemList).toEqual({ ready: false, failure: undefined, rows: [] });
      yield* fixture.notes.seed("Project/Items/Z.md", itemRecord("Élan 2", 10));
      yield* fixture.notes.seed("Outside/a.md", itemRecord("E\u0301lan 2", 11));
      yield* fixture.notes.seed("Project/Items/Ten.md", itemRecord("Élan 10", 12));
      yield* fixture.notes.seed(
        "Project/Items/A future.md",
        itemRecord("Future", 13, { schema: "product-engineering.item/v2" }),
      );
      yield* fixture.notes.seed("Project/Items/Ignore.md", { title: "A plain note" });
      yield* fixture.ready;

      const { rows } = yield* itemList;
      expect(rows.map(({ fileName }) => fileName)).toEqual(["A future", "a", "Z", "Ten"]);
      expect(rows[0]).toMatchObject({
        editable: false,
        issues: [{ code: "schema.newer", version: 2 }],
      });
      expect(rows.slice(1, 3).map((row) => row.issues)).toEqual([
        [{ key: "title", code: "title.duplicate" }],
        [{ key: "title", code: "title.duplicate" }],
      ]);
      expect(rows[3]?.issues).toEqual([]);
      expect(rows.map(shownItemName)).toEqual(["A future", "E\u0301lan 2", "Élan 2", "Élan 10"]);
    }).pipe(Effect.provide(fixture.layer));
  },
);
