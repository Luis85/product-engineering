import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import type { NoteStoreFixture } from "./fixture";
import { run, sampleFrontmatter } from "./fixture";

export function contractReads(makeFixture: () => NoteStoreFixture): void {
  it.effect(
    "lists schema-marked Markdown anywhere and preserves unknown keys and key order",
    () => {
      const fixture = makeFixture();
      return run(fixture, (store) =>
        Effect.gen(function* () {
          yield* fixture.seed("Outside/Recognized.md", sampleFrontmatter);
          yield* fixture.seed("Archive/Malformed.md", {
            schema: "product-engineering.not-a-marker",
          });
          yield* fixture.seed("Archive/Ordinary.md", { title: "Ordinary note" });
          yield* fixture.seed("Elsewhere/Other.md", { schema: "another.product/v1" });
          yield* fixture.settle;

          expect((yield* store.list).map(({ path }) => path)).toEqual([
            "Archive/Malformed.md",
            "Outside/Recognized.md",
          ]);
          const record = yield* store.read("Outside/Recognized.md");
          expect(record.frontmatter).toEqual(sampleFrontmatter);
          expect(Object.keys(record.frontmatter)).toEqual(Object.keys(sampleFrontmatter));
        }),
      );
    },
  );

  it.effect("recognizes uppercase Markdown extensions and ignores a leading dot alone", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const path = "Outside/Upper.MD";
        const hidden = "Archive/.md";
        yield* fixture.seed(path, sampleFrontmatter);
        yield* fixture.seed(hidden, sampleFrontmatter);
        yield* fixture.settle;

        expect((yield* store.list).map((note) => note.path)).toEqual([path]);
        expect(yield* store.read(path)).toEqual({ path, frontmatter: sampleFrontmatter });
        expect(yield* Effect.flip(store.read(hidden))).toMatchObject({
          _tag: "NoteNotFoundError",
        });
      }),
    );
  });

  it.effect(
    "separates unreadable blocks by folder and returns empty frontmatter for either kind",
    () => {
      const fixture = makeFixture();
      return run(fixture, (store) =>
        Effect.gen(function* () {
          yield* fixture.seed("Records/No block.md", "none");
          yield* fixture.seed("Records/Subfolder/Z broken.md", "broken");
          yield* fixture.seed("Records/A broken.md", "broken");
          yield* fixture.seed("Elsewhere/Broken.md", "broken");
          yield* fixture.settle;

          expect(yield* store.unreadable("Records")).toEqual([
            "Records/A broken.md",
            "Records/Subfolder/Z broken.md",
          ]);
          expect((yield* store.read("Records/No block.md")).frontmatter).toEqual({});
          expect((yield* store.read("Records/A broken.md")).frontmatter).toEqual({});
          expect(yield* Effect.flip(store.read("Records/Gone.md"))).toMatchObject({
            _tag: "NoteNotFoundError",
          });
        }),
      );
    },
  );

  it.effect("returns a typed vault read failure when the host read fails", () => {
    const fixture = makeFixture();
    fixture.setFailReads(true);
    return run(fixture, (store) =>
      Effect.gen(function* () {
        expect(yield* Effect.flip(store.list)).toMatchObject({ _tag: "VaultReadError" });
      }),
    );
  });
}
