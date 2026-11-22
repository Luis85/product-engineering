import { it } from "@effect/vitest";
import { Effect, Fiber, Result } from "effect";
import { expect } from "vitest";
import { eventually } from "../wait";
import type { NoteStoreFixture } from "./fixture";
import { run, sampleFrontmatter } from "./fixture";

function request(name: string) {
  return { folder: "Product/Records", name, frontmatter: sampleFrontmatter, body: "Body text\n" };
}

export function contractWrites(makeFixture: () => NoteStoreFixture): void {
  it.effect("creates nested folders and returns the written note before its index settles", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const created = yield* store.create(request("New item"));
        expect(created).toEqual({
          path: "Product/Records/New item.md",
          frontmatter: sampleFrontmatter,
        });
        expect(fixture.isFolder("Product")).toBe(true);
        expect(fixture.isFolder("Product/Records")).toBe(true);
        expect(yield* fixture.body(created.path)).toBe("Body text\n");
        yield* fixture.settle;
        expect(yield* store.read(created.path)).toEqual(created);
      }),
    );
  });

  it.effect("renames within a folder and trashes through the same port", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const created = yield* store.create(request("Original"));
        yield* fixture.settle;
        const renamed = yield* store.rename(created.path, "Renamed");
        expect(renamed).toEqual({
          path: "Product/Records/Renamed.md",
          frontmatter: sampleFrontmatter,
        });
        yield* fixture.settle;
        expect(yield* fixture.body(renamed.path)).toBe("Body text\n");
        expect(yield* Effect.flip(store.read(created.path))).toMatchObject({
          _tag: "NoteNotFoundError",
        });
        yield* store.trash(renamed.path);
        yield* fixture.settle;
        expect(yield* Effect.flip(store.read(renamed.path))).toMatchObject({
          _tag: "NoteNotFoundError",
        });
      }),
    );
  });

  it.effect("returns typed errors for a bad name and host write failures", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        expect(yield* Effect.flip(store.create(request(".hidden")))).toMatchObject({
          _tag: "InvalidNoteNameError",
          issue: "leading-dot",
        });
        expect(fixture.isFolder("Product")).toBe(false);
        const created = yield* store.create(request("Existing"));
        yield* fixture.settle;
        fixture.setFailWrites(true);
        expect(yield* Effect.flip(store.create(request("Other")))).toMatchObject({
          _tag: "NoteWriteError",
        });
        expect(yield* Effect.flip(store.trash(created.path))).toMatchObject({
          _tag: "NoteTrashError",
        });
      }),
    );
  });

  it.effect("lets a started write finish even when its caller interrupts it", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        fixture.holdWrites();
        const writer = yield* Effect.forkChild(
          store.create({
            ...request("Committed"),
            folder: "",
          }),
        );
        const interrupt = yield* Effect.gen(function* () {
          yield* Effect.promise(() =>
            eventually(() => expect(fixture.heldWrites()).toBeGreaterThan(0)),
          );
          return yield* Effect.forkChild(Fiber.interrupt(writer), { startImmediately: true });
        }).pipe(Effect.ensuring(Effect.sync(fixture.releaseWrites)));
        yield* Fiber.join(interrupt);
        yield* fixture.settle;
        expect(yield* fixture.body("Committed.md")).toBe("Body text\n");
      }),
    );
  });

  it.effect("writes and returns the same payload snapshot after a delayed create", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const input = {
          ...request("Snapshot"),
          folder: "",
          frontmatter: { ...sampleFrontmatter, flags: ["first"] },
        };
        fixture.holdWrites();
        const writer = yield* Effect.forkChild(store.create(input));
        try {
          yield* Effect.promise(() =>
            eventually(() => expect(fixture.heldWrites()).toBeGreaterThan(0)),
          );
          input.frontmatter.flags.push("later");
          input.body = "Changed body\n";
        } finally {
          fixture.releaseWrites();
        }

        const created = yield* Fiber.join(writer);
        expect(created.frontmatter.flags).toEqual(["first"]);
        yield* fixture.settle;
        expect(yield* store.read(created.path)).toEqual(created);
        expect(yield* fixture.body(created.path)).toBe("Body text\n");
      }),
    );
  });

  it.effect("reports a note deleted from outside while the rename is waiting", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const created = yield* store.create(request("Before"));
        yield* fixture.settle;
        fixture.holdWrites();
        const writer = yield* Effect.forkChild(Effect.flip(store.rename(created.path, "After")));
        try {
          yield* Effect.promise(() =>
            eventually(() => expect(fixture.heldWrites()).toBeGreaterThan(0)),
          );
          yield* fixture.removeOutside(created.path);
        } finally {
          fixture.releaseWrites();
        }
        expect(yield* Fiber.join(writer)).toMatchObject({ _tag: "NoteNotFoundError" });
      }),
    );
  });

  it.effect("lets an update see the latest vault text after an outside write", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const path = "Work/Record.md";
        yield* fixture.seed(path, { ...sampleFrontmatter, counter: 1 }, "Original body\n");
        yield* fixture.settle;
        fixture.holdWrites();
        const writer = yield* Effect.forkChild(
          store.update(path, (current) =>
            Result.succeed({ set: { counter: Number(current.counter) + 1 } }),
          ),
        );
        try {
          yield* Effect.promise(() =>
            eventually(() => expect(fixture.heldWrites()).toBeGreaterThan(0)),
          );
          yield* fixture.seed(path, { ...sampleFrontmatter, counter: 5 }, "Outside body\n");
          yield* fixture.settle;
        } finally {
          fixture.releaseWrites();
        }
        const result = yield* Fiber.join(writer);
        expect(result.frontmatter.counter).toBe(6);
        yield* fixture.settle;
        expect(yield* store.read(path)).toEqual(result);
        expect(yield* fixture.body(path)).toBe("Outside body\n");
      }),
    );
  });

  it.effect("does not call the updater after the file is removed while the write waits", () => {
    const fixture = makeFixture();
    return run(fixture, (store) =>
      Effect.gen(function* () {
        const path = "Work/Record.md";
        yield* fixture.seed(path, sampleFrontmatter);
        yield* fixture.settle;
        fixture.holdWrites();
        const writer = yield* Effect.forkChild(
          Effect.flip(
            store.update(path, () => {
              throw new Error("update must not run");
            }),
          ),
        );
        try {
          yield* Effect.promise(() =>
            eventually(() => expect(fixture.heldWrites()).toBeGreaterThan(0)),
          );
          yield* fixture.removeOutside(path);
        } finally {
          fixture.releaseWrites();
        }
        expect(yield* Fiber.join(writer)).toMatchObject({ _tag: "NoteNotFoundError" });
      }),
    );
  });
}
