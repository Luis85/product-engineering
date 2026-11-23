import * as fc from "fast-check";
import { expect, it } from "vitest";
import { gitDiff } from "../../../src/presentation/git/diff";

const file = (text: string) => ({ path: "Long note.md", bytes: new TextEncoder().encode(text) });

it("keeps a long unchanged note clean and locates an edit past the initial display window", () => {
  const prefix = Array.from({ length: 510 }, (_, index) => "Unchanged " + index).join("\n");
  const before = file(prefix + "\nPrevious acceptance criterion");
  const after = file(prefix + "\nCurrent acceptance criterion");
  expect(gitDiff(before, before)).toMatchObject({ identical: true, changedPages: [] });
  const changed = gitDiff(before, after);
  expect(changed.identical).toBe(false);
  expect(changed.lines).toEqual(
    expect.arrayContaining([
      { kind: "remove", text: "Previous acceptance criterion" },
      { kind: "add", text: "Current acceptance criterion" },
    ]),
  );
});

it("retains both distant edits in a 600-line note", () => {
  const before = Array.from({ length: 600 }, (_, index) => "Line " + (index + 1));
  const after = [...before];
  after[9] = "First change";
  after[499] = "Second change";
  const changes = gitDiff(file(before.join("\n")), file(after.join("\n")));
  expect(changes.lines.filter(({ kind }) => kind === "add").map(({ text }) => text.trim())).toEqual(
    ["First change", "Second change"],
  );
});

it("reconstructs each side exactly with repeated lines, insertions and removals", () => {
  const text = fc
    .array(fc.constantFrom("A\n", "B\n", "\r\n", "Übergabe\r\n"), { maxLength: 25 })
    .map((lines) => lines.join(""));
  fc.assert(
    fc.property(text, text, (before, after) => {
      const { lines, identical } = gitDiff(file(before), file(after));
      const reconstruct = (excluded: "add" | "remove") =>
        lines
          .filter(({ kind }) => kind !== excluded)
          .map((line) => line.text)
          .join("");
      expect(identical).toBe(before === after);
      expect(reconstruct("add")).toBe(before);
      expect(reconstruct("remove")).toBe(after);
    }),
  );
});

it("preserves both sides of a broad replacement and bounds each rendered page", () => {
  const before = "Shared start\n" + "Original\n".repeat(550) + "Shared end\n";
  const after = "Shared start\n" + "Modified\n".repeat(570) + "Shared end\n";
  const { lines, changedPages } = gitDiff(file(before), file(after));
  expect(lines[0]).toEqual({ kind: "same", text: "Shared start\n" });
  expect(lines.at(-1)).toEqual({ kind: "same", text: "Shared end\n" });
  expect(lines.filter(({ kind }) => kind === "remove")).toHaveLength(550);
  expect(lines.filter(({ kind }) => kind === "add")).toHaveLength(570);
  expect(changedPages).toEqual([0, 1, 2]);
});
