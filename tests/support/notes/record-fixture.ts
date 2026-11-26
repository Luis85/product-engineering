import { Effect, Layer } from "effect";
import { defineRecords, NoteStore, NoteWriteError } from "../../../src/application/notes";
import { recordId, schemaMarker } from "../../../src/domain/notes";
import type { Frontmatter } from "../../../src/domain/notes";
import { sequentialIdGenerator } from "../../../src/infrastructure/memory/notes";
import { indexFixture } from "./index-fixture";
import { testNoteType } from "./test-note-type";

export const sampleType = testNoteType;
export const samples = defineRecords({
  type: sampleType,
  title: "title",
  fallbackName: () => "Sample",
  log: "sample",
});

export function sampleRecord(title: string, sequence = 100, more: Frontmatter = {}): Frontmatter {
  const uuid = `00000000-0000-0000-0000-${sequence.toString(16).padStart(12, "0")}`;
  return {
    schema: schemaMarker(sampleType.type, sampleType.version),
    id: recordId(sampleType.type, uuid),
    title,
    ...more,
  };
}

export function recordFixture(rootFolder = "Team") {
  const fixture = indexFixture([sampleType], { rootFolder });
  let nextRename = Effect.void;
  let failRename = false;
  const store = Layer.effect(
    NoteStore,
    Effect.map(NoteStore, (original) => ({
      ...original,
      rename: (path: string, name: string) =>
        Effect.suspend(() => {
          const before = nextRename;
          nextRename = Effect.void;
          return Effect.andThen(
            before,
            failRename ? Effect.fail(new NoteWriteError()) : original.rename(path, name),
          );
        }),
    })),
  );
  const layer = Layer.merge(Layer.provideMerge(store, fixture.layer), sequentialIdGenerator());
  return {
    ...fixture,
    layer,
    ready: Effect.andThen(
      fixture.vaultReady,
      fixture.waitForSnapshot(sampleType, ({ ready }) => ready),
    ),
    indexed: Effect.andThen(fixture.advanceBatch, samples.list),
    stored: (path: string) => NoteStore.use((source) => source.read(path)),
    storedPaths: NoteStore.use((source) =>
      Effect.map(source.list, (notes) => notes.map((note) => note.path).toSorted()),
    ),
    beforeNextRename: (effect: Effect.Effect<void>) => {
      nextRename = effect;
    },
    setFailRename: (fail: boolean) => {
      failRename = fail;
    },
  };
}
