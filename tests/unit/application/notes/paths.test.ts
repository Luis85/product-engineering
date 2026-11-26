import { Effect } from "effect";
import { expect, it } from "vitest";
import { copyFrontmatter, recordNotes } from "../../../../src/application/notes/frontmatter";
import { pathsInFolder, planRename } from "../../../../src/application/notes/paths";

it("selects nested paths below a folder and returns them in codepoint order", () => {
  const all = ["Rootish/Skipped.md", "Root/nested/deep.md", "Root/A.md", "Outside.md"];
  expect(pathsInFolder("Root", all)).toEqual(["Root/A.md", "Root/nested/deep.md"]);
  expect(pathsInFolder("/", all)).toEqual([
    "Outside.md",
    "Root/A.md",
    "Root/nested/deep.md",
    "Rootish/Skipped.md",
  ]);
});

it("plans the note's own case-only rename inside its existing folder", async () => {
  await expect(
    Effect.runPromise(planRename("Folder/Étage.md", "E\u0301TAGE", ["Étage.md", "Sibling.md"])),
  ).resolves.toBe("Folder/ÉTAGE.md");
});

it("rejects a clash against another file or folder and rejects forbidden names", async () => {
  const clash = await Effect.runPromise(
    Effect.flip(planRename("Draft.md", "Archive", ["Draft.md", "archive.MD"])),
  );
  expect(clash._tag).toBe("NotePathTakenError");
  const invalid = await Effect.runPromise(
    Effect.flip(planRename("Draft.md", "Elsewhere/Title", ["Draft.md"])),
  );
  expect(invalid).toMatchObject({ _tag: "InvalidNoteNameError", issue: "forbidden-character" });
});

it("copies arbitrary frontmatter keys in order and returns only records", () => {
  const raw = { schema: "product-engineering.item/v1", custom: ["label"], title: "Draft" };
  const clone = copyFrontmatter(raw);
  expect(clone).toEqual(raw);
  expect(clone).not.toBe(raw);
  expect(Object.keys(clone)).toEqual(["schema", "custom", "title"]);
  expect(copyFrontmatter(null)).toEqual({});
  expect(copyFrontmatter(["broken"])).toEqual({});
  expect(
    recordNotes([
      { path: "Z.md", frontmatter: clone },
      { path: "Folder/Invalid.md", frontmatter: { schema: "product-engineering.invalid" } },
      { path: "Unrelated.md", frontmatter: { schema: "outside.item/v1" } },
    ]).map(({ path }) => path),
  ).toEqual(["Folder/Invalid.md", "Z.md"]);
});
