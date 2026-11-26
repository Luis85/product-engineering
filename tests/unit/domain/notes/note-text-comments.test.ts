import { Result } from "effect";
import { expect, it } from "vitest";
import { editNoteText, splitNoteText } from "../../../../src/domain/notes";
import { scanValueLine } from "../../../../src/domain/notes/line-comment";

it.each([
  [' "A # B"', undefined],
  [' [a, "b # c"]', undefined],
  [" A#B", undefined],
  [" A # B", " # B"],
  [" foo  \t# keep", "  \t# keep"],
  [' "a \\"quoted # text"  # outside', "  # outside"],
  [" 'O''Connor # plain' \t# outside", " \t# outside"],
  [" O'Connor # outside", " # outside"],
  [' A, "ordinary # outside', " # outside"],
  [' "an unclosed quote # still inside', undefined],
  [" 'another unclosed quote # still inside", undefined],
  [" \t# empty value", " \t# empty value"],
])("detects an actual trailing comment in %j", (value, expected) => {
  expect(scanValueLine(value).comment).toBe(expected);
});

it("preserves the primary inline comment and removes comments within the replaced list", () => {
  const text =
    "---\ntags: \t# main\n- old\n  # belongs to the list\n- stale\n# stays between properties\nother: 'yes'\n---\n";
  const before = { tags: ["old", "stale"], other: "yes" };
  const after = { ...before, tags: ["only", "new"] };
  expect(editNoteText(splitNoteText(text), before, after)).toEqual(
    Result.succeed(
      "---\ntags: \t# main\n  - only\n  - new\n# stays between properties\nother: 'yes'\n---\n",
    ),
  );
});

it("removes a key's inline comment along with the key", () => {
  const text = "---\n# keep\nstatus: open # remove\nother: yes\n---\n";
  expect(
    editNoteText(splitNoteText(text), { status: "open", other: "yes" }, { other: "yes" }),
  ).toEqual(Result.succeed("---\n# keep\nother: yes\n---\n"));
});
