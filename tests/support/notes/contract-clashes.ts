import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import type { NoteStoreFixture } from "./fixture";
import { run, sampleFrontmatter } from "./fixture";

export function contractClashes(makeFixture: () => NoteStoreFixture): void {
  it.effect("suffixes case, Unicode and folder clashes on create", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        yield* fixture.seed("Work/Résumé.md", "none");
        yield* fixture.seed("Work/RÉSUMÉ (2).md/Claim.md", "none");
        yield* fixture.settle;

        const created = yield* store.create({
          folder: "Work",
          name: "Re\u0301sume\u0301",
          frontmatter: sampleFrontmatter,
        });
        expect(created.path.normalize("NFC")).toBe("Work/Résumé (3).md");
      }),
    );
  });

  it.effect("allows a rename that only changes case and refuses another occupied name", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        yield* fixture.seed("Work/Alpha.md", sampleFrontmatter);
        yield* fixture.seed("Work/Beta.md", "none");
        yield* fixture.settle;

        expect(yield* Effect.flip(store.rename("Work/Alpha.md", "BETA"))).toMatchObject({
          _tag: "NotePathTakenError",
        });
        expect((yield* store.rename("Work/Alpha.md", "ALPHA")).path).toBe("Work/ALPHA.md");
      }),
    );
  });

  it.effect("normalizes note names before returning a usable created or renamed path", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const created = yield* store.create({
          folder: "Work",
          name: "Title\u00a0Year",
          frontmatter: sampleFrontmatter,
        });
        expect(created.path).toBe("Work/Title Year.md");
        yield* fixture.settle;
        expect(yield* store.read(created.path)).toEqual(created);

        const renamed = yield* store.rename(created.path, "Revised\u00a0Year");
        expect(renamed.path).toBe("Work/Revised Year.md");
        yield* fixture.settle;
        expect(yield* store.read(renamed.path)).toEqual(renamed);
      }),
    );
  });
}
