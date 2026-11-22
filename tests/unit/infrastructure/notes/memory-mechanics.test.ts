import { Effect, Fiber, Layer, Stream } from "effect";
import { expect, it } from "vitest";
import { IdGenerator, NoteOpener, NoteStore } from "../../../../src/application/notes";
import { EventBus, EventBusLive } from "../../../../src/application/shell";
import {
  memoryNoteStore,
  sequentialIdGenerator,
  TEST_ONLY_MARKER,
} from "../../../../src/infrastructure/memory/notes";

it("shares a vault between the memory store and its opener", async () => {
  const fixture = memoryNoteStore();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* fixture.seed(
        "Moved/One.md",
        { schema: "product-engineering.item/v1", name: "One" },
        "Body",
      );
      const store = yield* NoteStore;
      const opener = yield* NoteOpener;
      const all = yield* store.list;
      expect(all.map(({ path }) => path)).toEqual(["Moved/One.md"]);
      expect(fixture.isFolder("Moved")).toBe(true);
      expect(fixture.body("Moved/One.md")).toBe("Body");
      yield* opener.open("Moved/One.md");
      expect(fixture.opened()).toEqual(["Moved/One.md"]);
      yield* fixture.removeOutside("Moved/One.md");
      expect(yield* store.list).toEqual([]);
    }).pipe(Effect.provide(Layer.mergeAll(fixture.layer, fixture.opener))),
  );
});

it("publishes file and metadata events when a memory vault is used beside an EventBus", async () => {
  const fixture = memoryNoteStore();
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const bus = yield* EventBus;
        const store = yield* NoteStore;
        const events = yield* bus.subscribe;
        const received = yield* Effect.forkChild(Stream.runCollect(Stream.take(events, 6)));
        yield* fixture.seed("One.md", { schema: "product-engineering.item/v1" });
        yield* fixture.seed("One.md", { schema: "product-engineering.item/v1", changed: true });
        yield* store.rename("One.md", "Two");
        yield* store.trash("Two.md");
        expect(
          (yield* Fiber.join(received)).map((event) => [
            event._tag,
            "path" in event ? event.path : undefined,
          ]),
        ).toEqual([
          ["FileCreated", "One.md"],
          ["MetadataChanged", "One.md"],
          ["FileModified", "One.md"],
          ["MetadataChanged", "One.md"],
          ["FileRenamed", "Two.md"],
          ["FileDeleted", "Two.md"],
        ]);
      }),
    ).pipe(Effect.provide(Layer.mergeAll(fixture.layer, EventBusLive))),
  );
});

it("allocates independent sequential lowercase UUIDs for test records", async () => {
  const pair = Effect.gen(function* () {
    const ids = yield* IdGenerator;
    return [yield* ids.nextId, yield* ids.nextId];
  });
  const first = await Effect.runPromise(Effect.provide(pair, sequentialIdGenerator()));
  const second = await Effect.runPromise(Effect.provide(pair, sequentialIdGenerator()));
  expect(first).toEqual(second);
  expect(first).toEqual([
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
  ]);
});

it("marks synthetic write failures without changing their typed category", async () => {
  const fixture = memoryNoteStore();
  fixture.setFailWrites(true);
  const failure = await Effect.runPromise(
    Effect.flip(
      NoteStore.use((store) => store.create({ folder: "/", name: "Probe", frontmatter: {} })),
    ).pipe(Effect.provide(fixture.layer)),
  );
  expect(failure).toMatchObject({ _tag: "NoteWriteError", message: TEST_ONLY_MARKER });
  expect(fixture.body("Probe.md")).toBeUndefined();
});
