import { Effect } from "effect";
import type { Layer } from "effect";
import { NoteStore } from "../../../src/application/notes";
import type { Frontmatter } from "../../../src/domain/notes";

export type SeedFrontmatter = Frontmatter | "none" | "broken";

export interface NoteStoreFixture {
  readonly layer: Layer.Layer<NoteStore>;
  readonly seed: (path: string, frontmatter: SeedFrontmatter, body?: string) => Effect.Effect<void>;
  readonly removeOutside: (path: string) => Effect.Effect<void>;
  readonly settle: Effect.Effect<void>;
  readonly body: (path: string) => Effect.Effect<string | undefined>;
  readonly isFolder: (path: string) => boolean;
  readonly setFailReads: (value: boolean) => void;
  readonly setFailWrites: (value: boolean) => void;
  readonly holdWrites: () => void;
  readonly releaseWrites: () => void;
  readonly heldWrites: () => number;
}

export const sampleFrontmatter = {
  schema: "product-engineering.item/v1",
  id: "item-sample",
  title: "A record",
  extra: "third-party value",
  flags: ["one", "two"],
};

export function run<A, E>(
  fixture: NoteStoreFixture,
  use: (store: Effect.Success<typeof NoteStore>) => Effect.Effect<A, E>,
): Effect.Effect<A, E> {
  return Effect.provide(NoteStore.use(use), fixture.layer);
}
