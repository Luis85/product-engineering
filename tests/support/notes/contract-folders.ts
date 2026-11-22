import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import type { NoteStoreFixture } from "./fixture";
import { run, sampleFrontmatter } from "./fixture";

export function contractFolders(makeFixture: () => NoteStoreFixture, caseSensitive: boolean): void {
  it.effect("reuses the vault spelling of each folder segment", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        yield* fixture.seed("my notes/Records/Unreadable.md", "broken");
        yield* fixture.seed("my notes/Archive/Outside.md", "broken");
        yield* fixture.settle;
        const note = yield* store.create({
          folder: "My Notes/records/New",
          name: "Example",
          frontmatter: sampleFrontmatter,
        });
        expect(note.path).toBe("my notes/Records/New/Example.md");
        expect(fixture.isFolder("my notes/Records/New")).toBe(true);
        expect(yield* store.unreadable("My Notes/records")).toEqual([
          "my notes/Records/Unreadable.md",
        ]);
      }),
    );
  });

  if (caseSensitive) {
    it.effect("uses the exact folder first, otherwise the first clash by code unit", () => {
      const fixture = makeFixture();
      return run(fixture, (store) =>
        Effect.gen(function* () {
          yield* fixture.seed("Work/records/Lowercase.md", "broken");
          yield* fixture.seed("Work/Records/Capitalized.md", "broken");
          yield* fixture.settle;
          const create = (folder: string) =>
            store.create({ folder, name: "Example", frontmatter: sampleFrontmatter });
          expect((yield* create("Work/records")).path).toBe("Work/records/Example.md");
          expect((yield* create("Work/RECORDS")).path).toBe("Work/Records/Example.md");
          expect(yield* store.unreadable("Work/records")).toEqual(["Work/records/Lowercase.md"]);
          expect(yield* store.unreadable("Work/RECORDS")).toEqual(["Work/Records/Capitalized.md"]);
        }),
      );
    });
  }
}
