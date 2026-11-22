import { Deferred, Effect, Exit } from "effect";
import { expect, it, vi } from "vitest";
import {
  asDefect,
  createNote,
  trashCommand,
  writeCommand,
} from "../../../../src/application/notes/command";
import { NotePathTakenError, NoteWriteError } from "../../../../src/application/notes";

const input = {
  folder: "Folder",
  name: "Draft",
  frontmatter: { schema: "product-engineering.item/v1", title: "yes" },
  body: "Body",
};

it("treats throws from plugin-owned code as defects", async () => {
  const failure = await Effect.runPromiseExit(
    asDefect(() => {
      throw new Error("own code");
    }),
  );
  expect(Exit.hasDies(failure)).toBe(true);
  expect(Exit.hasFails(failure)).toBe(false);
});

it.each([
  ["write", writeCommand],
  ["trash", trashCommand],
] as const)("commits a started %s even if its caller aborts", async (_, command) => {
  const controller = new AbortController();
  const started = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  const commit = vi.fn<() => void>();
  const pending = Effect.runPromiseExit(
    command(
      Effect.gen(function* () {
        yield* Deferred.succeed(started, undefined);
        yield* Deferred.await(release);
        yield* Effect.sync(commit);
      }),
    ),
    { signal: controller.signal },
  );

  await Effect.runPromise(Deferred.await(started));
  controller.abort();
  await Effect.runPromise(Deferred.succeed(release, undefined));
  await pending;
  expect(commit).toHaveBeenCalledOnce();
});

it("chooses a free name and returns the frontmatter written by the adapter", async () => {
  const write = vi
    .fn<(path: string, text: string) => Effect.Effect<string>>()
    .mockImplementation((path) => Effect.succeed(path));
  const result = await Effect.runPromise(createNote(input, ["DRAFT.md", "draft (2).md"], write));
  expect(result).toEqual({ path: "Folder/Draft (3).md", frontmatter: input.frontmatter });
  expect(write).toHaveBeenCalledExactlyOnceWith(
    "Folder/Draft (3).md",
    '---\nschema: product-engineering.item/v1\ntitle: "yes"\n---\nBody',
    { frontmatter: input.frontmatter, body: input.body },
  );
});

it("retries when the vault reports a clash after planning", async () => {
  const write = vi
    .fn<(path: string, text: string) => Effect.Effect<string, NotePathTakenError>>()
    .mockReturnValueOnce(Effect.fail(new NotePathTakenError()))
    .mockImplementation((path) => Effect.succeed(path));

  const result = await Effect.runPromise(createNote(input, [], write));
  expect(result.path).toBe("Folder/Draft (2).md");
  expect(write.mock.calls.map(([path]) => path)).toEqual([
    "Folder/Draft.md",
    "Folder/Draft (2).md",
  ]);
});

it("surfaces a write failure without trying another name", async () => {
  const write = vi
    .fn<(path: string, text: string) => Effect.Effect<string, NoteWriteError>>()
    .mockReturnValue(Effect.fail(new NoteWriteError()));
  const failure = await Effect.runPromise(Effect.flip(createNote(input, [], write)));
  expect(failure._tag).toBe("NoteWriteError");
  expect(write).toHaveBeenCalledOnce();
});

it("checks invalid names and exhausts collisions without performing a write", async () => {
  const write = vi.fn<(path: string, text: string) => Effect.Effect<string>>();
  const invalid = await Effect.runPromise(
    Effect.flip(createNote({ ...input, name: ".dot" }, [], write)),
  );
  expect(invalid).toMatchObject({ _tag: "InvalidNoteNameError", issue: "leading-dot" });
  const taken = [
    "Draft.md",
    ...Array.from({ length: 99 }, (_, index) => `Draft (${index + 2}).md`),
  ];
  const exhausted = await Effect.runPromise(Effect.flip(createNote(input, taken, write)));
  expect(exhausted._tag).toBe("NotePathTakenError");
  expect(write).not.toHaveBeenCalled();
});

it("treats serializer defects as defects before invoking the adapter", async () => {
  const write = vi.fn<(path: string, text: string) => Effect.Effect<string>>();
  const result = await Effect.runPromiseExit(
    createNote({ ...input, frontmatter: { nested: { bad: true } } }, [], write),
  );
  expect(Exit.hasDies(result)).toBe(true);
  expect(write).not.toHaveBeenCalled();
});
