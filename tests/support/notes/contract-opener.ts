import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Layer } from "effect";
import { expect } from "vitest";
import { NoteOpener } from "../../../src/application/notes";
import { sampleFrontmatter } from "./fixture";
import type { NoteStoreFixture } from "./fixture";

type NoteOpenerFixture = Pick<NoteStoreFixture, "seed" | "settle"> & {
  readonly opener: Layer.Layer<NoteOpener>;
  readonly opened: () => readonly string[];
};

export function contractOpener(makeFixture: () => NoteOpenerFixture): void {
  it.effect("opens the identified Markdown note and rejects missing paths", () => {
    const fixture = makeFixture();
    return Effect.gen(function* () {
      const opener = yield* NoteOpener;
      yield* fixture.seed("Work/Original.md", sampleFrontmatter);
      yield* fixture.settle;
      yield* opener.open("Work/Original.md");
      expect(fixture.opened()).toEqual(["Work/Original.md"]);
      expect(yield* Effect.flip(opener.open("Work/Gone.md"))).toMatchObject({
        _tag: "NoteNotFoundError",
      });
    }).pipe(Effect.provide(fixture.opener));
  });
}
