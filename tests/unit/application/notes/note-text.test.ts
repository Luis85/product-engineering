import { Result } from "effect";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { updateNoteContent, updateNoteText } from "../../../../src/application/notes/note-text";

const edited = () => Result.succeed({ set: { status: "done" } });

const parseDifferent = (yaml: string): unknown =>
  yaml.includes("status: done") ? { status: "unexpected" } : parse(yaml);

const reorder = (yaml: string): unknown =>
  yaml.includes("status: done") ? { status: "done", title: "Example" } : parse(yaml);

it.each([
  {
    input: "\uFEFF---\r\nstatus: open # Keep\r\n---\r\nprior\r\n",
    body: "next\n",
    saved: "\uFEFF---\r\nstatus: open # Keep\r\n---\r\nnext\r\n",
    savedBody: "next\r\n",
    frontmatter: { status: "open" },
  },
  {
    input: "---\nstatus: open\n---",
    body: "new content",
    saved: "---\nstatus: open\n---\nnew content",
    savedBody: "new content",
    frontmatter: { status: "open" },
  },
  {
    input: "---\nstatus: open\n---\nprior",
    body: "",
    saved: "---\nstatus: open\n---\n",
    savedBody: "",
    frontmatter: { status: "open" },
  },
  {
    input: "Plain Markdown",
    body: "Replacement",
    saved: "Replacement",
    savedBody: "Replacement",
    frontmatter: {},
  },
])(
  "changes the body of $input without rewriting its existing properties",
  ({ input, body, saved, savedBody, frontmatter }) => {
    expect(updateNoteContent(input, () => Result.succeed({ patch: {}, body }), parse)).toEqual(
      Result.succeed({ text: saved, frontmatter, body: savedBody }),
    );
  },
);

it("rejects an ambiguous body edit while preserving a semantic no-op", () => {
  const text = "---\nstatus: open\n--- invalid\nOriginal";
  expect(
    updateNoteContent(text, () => Result.succeed({ patch: {}, body: "Original" }), parse),
  ).toEqual(Result.succeed({ text, frontmatter: { status: "open" }, body: "Original" }));
  const changed = updateNoteContent(
    text,
    () => Result.succeed({ patch: {}, body: "Draft" }),
    parse,
  );
  expect(Result.isFailure(changed) && changed.failure).toMatchObject({
    _tag: "NoteWriteRefusedError",
    reason: "layout",
  });
});

it("preserves a BOM, CRLF, trailing comment and accepted closing line when changing a key", () => {
  const text = "\uFEFF---\r\nzip: 01067\r\nstatus: open  # Keep\r\n----\r\n# body\r\n";
  expect(updateNoteText(text, edited, parse)).toEqual(
    Result.succeed({
      text: text.replace("open  # Keep", "done  # Keep"),
      frontmatter: { zip: 1067, status: "done" },
    }),
  );
});

it("adds YAML to a note without a block and retains a comment-only block", () => {
  expect(updateNoteText("Body\n", edited, parse)).toEqual(
    Result.succeed({
      text: "---\nstatus: done\n---\nBody\n",
      frontmatter: { status: "done" },
    }),
  );
  const comments = "---\n# Keep this comment\n--- \t\nBody\n";
  expect(updateNoteText(comments, edited, parse)).toEqual(
    Result.succeed({
      text: "---\n# Keep this comment\nstatus: done\n--- \t\nBody\n",
      frontmatter: { status: "done" },
    }),
  );
});

it.each(["bad: [", "- entry", "null", "23"])(
  "refuses unreadable YAML %s without sending parser details",
  (yaml) => {
    const result = updateNoteText(
      `---\n${yaml}\n---\n`,
      () => {
        throw new Error("must not run");
      },
      parse,
    );
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "NoteUnreadableError",
    });
  },
);

it.each(["--- extra", "---#comment", "-----"])(
  "refuses to change a block closed with %s but accepts a no-op",
  (closer) => {
    const text = `---\nstatus: open\n${closer}\nBody\n`;
    const result = updateNoteText(text, edited, parse);
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "layout",
    });
    expect(updateNoteText(text, () => Result.succeed({ set: { status: "open" } }), parse)).toEqual(
      Result.succeed({ text, frontmatter: { status: "open" } }),
    );
  },
);

it("accepts a semantic no-op for a flow-map block and refuses to rewrite it", () => {
  const text = "---\n{status: open, flags: [first]}\n---\nBody\n";
  expect(updateNoteText(text, () => Result.succeed({ set: { flags: ["first"] } }), parse)).toEqual(
    Result.succeed({ text, frontmatter: { status: "open", flags: ["first"] } }),
  );
  const result = updateNoteText(text, edited, parse);
  expect(Result.isFailure(result) && result.failure).toMatchObject({
    _tag: "NoteWriteRefusedError",
    reason: "layout",
  });
});

it("rejects output that does not parse back to the expected data", () => {
  const result = updateNoteText("---\nstatus: open\n---\n", edited, parseDifferent);
  expect(Result.isFailure(result) && result.failure).toMatchObject({
    _tag: "NoteWriteRefusedError",
    reason: "layout",
  });
});

it("rejects a parsed result that changes property order", () => {
  const result = updateNoteText("---\ntitle: Example\nstatus: open\n---\n", edited, reorder);
  expect(Result.isFailure(result) && result.failure).toMatchObject({
    _tag: "NoteWriteRefusedError",
    reason: "layout",
  });
});

it("returns the typed failure from change and propagates its programmer exceptions", () => {
  const invalid = { _tag: "TestConflict" } as const;
  const text = "---\nstatus: open\n---\n";
  expect(updateNoteText(text, () => Result.fail(invalid), parse)).toEqual(Result.fail(invalid));
  const error = new Error("change defect");
  expect(() =>
    updateNoteText(
      text,
      () => {
        throw error;
      },
      parse,
    ),
  ).toThrow(error);
});
