import { Effect, Layer } from "effect";
import { itemList } from "../../../src/application/items";
import { itemWritesLayer } from "../../../src/application/items/use-cases";
import { NoteStore } from "../../../src/application/notes";
import { itemType } from "../../../src/domain/items";
import { recordId, schemaMarker } from "../../../src/domain/notes";
import type { Frontmatter } from "../../../src/domain/notes";
import { sequentialIdGenerator } from "../../../src/infrastructure/memory/notes";
import { indexFixture } from "../notes/index-fixture";

export function itemRecord(title: string, index: number, more: Frontmatter = {}): Frontmatter {
  const uuid = "00000000-0000-0000-0000-" + index.toString(16).padStart(12, "0");
  return {
    schema: schemaMarker(itemType.type, itemType.version),
    id: recordId(itemType.type, uuid),
    title,
    status: "open",
    ...more,
  };
}

export function itemFixture() {
  const fixture = indexFixture([itemType], { rootFolder: "Project" });
  return {
    ...fixture,
    layer: Layer.mergeAll(fixture.layer, sequentialIdGenerator(), itemWritesLayer),
    ready: Effect.andThen(
      fixture.vaultReady,
      fixture.waitForSnapshot(itemType, ({ ready }) => ready),
    ),
    indexed: Effect.andThen(fixture.advanceBatch, itemList),
    stored: (path: string) => NoteStore.use((store) => store.read(path)),
  };
}
