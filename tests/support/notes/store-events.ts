import { Effect, Result } from "effect";
import { vi } from "vitest";
import type { AppEvent } from "../../../src/application/events";
import type { NoteStore } from "../../../src/application/notes";
import { EventBus } from "../../../src/application/shell";
import type { NoteStoreFixture } from "./fixture";
import { sampleFrontmatter } from "./fixture";

type Store = Effect.Success<typeof NoteStore>;
type Step = {
  readonly name: string;
  readonly run: (store: Store, seed: NoteStoreFixture["seed"]) => Effect.Effect<unknown, unknown>;
  readonly events: readonly AppEvent[];
};

const original = "Work/Original.md";
const renamed = "Work/Renamed.md";
const external = "Outside/External.md";

function fileEvent<T extends "FileCreated" | "FileModified" | "FileDeleted" | "MetadataChanged">(
  tag: T,
  path: string,
) {
  return { _tag: tag, path, extension: "md" };
}

const STORE_EVENT_STEPS: readonly Step[] = [
  {
    name: "create",
    run: (store) =>
      store.create({ folder: "Work", name: "Original", frontmatter: sampleFrontmatter }),
    events: [fileEvent("FileCreated", original), fileEvent("MetadataChanged", original)],
  },
  {
    name: "update",
    run: (store) => store.update(original, () => Result.succeed({ set: { title: "Updated" } })),
    events: [fileEvent("FileModified", original), fileEvent("MetadataChanged", original)],
  },
  {
    name: "unchanged update",
    run: (store) =>
      store.update(original, () =>
        Result.succeed({ set: { title: "Updated", flags: ["one", "two"] } }),
      ),
    events: [],
  },
  {
    name: "rename",
    run: (store) => store.rename(original, "Renamed"),
    events: [{ _tag: "FileRenamed", path: renamed, oldPath: original, extension: "md" }],
  },
  {
    name: "trash",
    run: (store) => store.trash(renamed),
    events: [fileEvent("FileDeleted", renamed)],
  },
  {
    name: "external create",
    run: (_, seed) => seed(external, sampleFrontmatter),
    events: [fileEvent("FileCreated", external), fileEvent("MetadataChanged", external)],
  },
  {
    name: "external edit",
    run: (_, seed) => seed(external, { ...sampleFrontmatter, title: "External edit" }),
    events: [fileEvent("FileModified", external), fileEvent("MetadataChanged", external)],
  },
];

export const expectedStoreEvents = STORE_EVENT_STEPS.map(({ name, events }) => ({ name, events }));

export function observeStoreEvents(
  store: Store,
  fixture: Pick<NoteStoreFixture, "seed" | "settle">,
) {
  return Effect.gen(function* () {
    const bus = yield* EventBus;
    const publish = vi.spyOn(bus, "publish");
    try {
      const observed: { name: string; events: AppEvent[] }[] = [];
      for (const step of STORE_EVENT_STEPS) {
        publish.mockClear();
        yield* step.run(store, fixture.seed);
        yield* fixture.settle;
        observed.push({ name: step.name, events: publish.mock.calls.map(([event]) => event) });
      }
      return observed;
    } finally {
      publish.mockRestore();
    }
  });
}
