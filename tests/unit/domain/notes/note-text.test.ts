import { Result } from "effect";
import * as fc from "fast-check";
import { expect, it } from "vitest";
import {
  editNoteText,
  frontmatterYaml,
  sameFrontmatter,
  splitNoteText,
  yamlEntry,
} from "../../../../src/domain/notes";

it.each(["---", "--- ", "---\t", "----", "-----", "---- ", "--- x", "---x", "--- # c"])(
  "finds the first closing line %j under the native split rules",
  (closer) => {
    const text = "\uFEFF---\r\nstatus: open\r\n" + closer + "\r\nbody\r\n";
    const split = splitNoteText(text);
    expect(split.bom).toBe("\uFEFF");
    expect(split.eol).toBe("\r\n");
    expect(frontmatterYaml(split)).toBe("status: open\r\n");
    expect(split.frontmatter).toEqual({
      opening: "---\r\n",
      yaml: "status: open\r\n",
      closing: closer + "\r\n",
    });
    expect(split.body).toBe("body\r\n");
    expect(split.layoutSupported).toBe(/^(?:---[ \t]*|----)$/.test(closer));
  },
);

it("leaves a note with no matching frontmatter fences as body text", () => {
  for (const text of ["body\n---\n", "---\nkey: value\n ---\n...\n", "---", ""]) {
    const split = splitNoteText(text);
    expect(split.body).toBe(text);
    expect(frontmatterYaml(split)).toBeUndefined();
  }
});

it("reads the lone-carriage-return block but refuses changes", () => {
  const text = "\uFEFF---\rstatus: open\r---\rbody";
  const split = splitNoteText(text);
  expect(frontmatterYaml(split)).toBe("status: open\r");
  expect(split.layoutSupported).toBe(false);
  expect(editNoteText(split, { status: "open" }, { status: "done" })).toEqual(
    Result.fail("layout"),
  );
  expect(editNoteText(split, { status: "open" }, { status: "open" })).toEqual(Result.succeed(text));
});

it("adds frontmatter using the body's first line ending and preserves its BOM", () => {
  const text = "\uFEFFfirst\r\nsecond";
  const updated = editNoteText(splitNoteText(text), {}, { status: "open" });
  expect(updated).toEqual(Result.succeed("\uFEFF---\r\nstatus: open\r\n---\r\nfirst\r\nsecond"));
});

it("replaces only the selected key and its continuation lines", () => {
  const text =
    "---\r\n# keep\r\nzip: 01067\r\n'quoted key':\r\n- one\r\n# remove this list comment\r\n- two\r\n# keep next\r\nother: 'yes'\r\n----\r\nBody\r\n";
  const before = { zip: 1067, "quoted key": ["one", "two"], other: "yes" };
  const after = { zip: 1067, "quoted key": "new", other: "yes" };
  expect(editNoteText(splitNoteText(text), before, after)).toEqual(
    Result.succeed(
      "---\r\n# keep\r\nzip: 01067\r\nquoted key: new\r\n# keep next\r\nother: 'yes'\r\n----\r\nBody\r\n",
    ),
  );
});

it("preserves other block scalars and appends new keys before the original closing fence", () => {
  const text = "---\nstatus: open\nbody: |-\n  keep\n  # literal content\n--- \t\nBody";
  const before = { status: "open", body: "keep\n# literal content" };
  const after = { body: "keep\n# literal content", dates: ["2026-11-22"] };
  expect(editNoteText(splitNoteText(text), before, after)).toEqual(
    Result.succeed(
      "---\nbody: |-\n  keep\n  # literal content\ndates:\n  - !!str 2026-11-22\n--- \t\nBody",
    ),
  );
});

it("preserves untouched blank lines and removes fences whose content was all removed", () => {
  expect(
    editNoteText(splitNoteText("\uFEFF---\ntitle: value\n---\nBody"), { title: "value" }, {}),
  ).toEqual(Result.succeed("\uFEFFBody"));
  expect(
    editNoteText(splitNoteText("---\ntitle: value\n\n# keep it\n---"), { title: "value" }, {}),
  ).toEqual(Result.succeed("---\n\n# keep it\n---"));
});

it.each([
  { text: "--- \nkey: value\n---\n", before: {} },
  { text: "---\nkey: value\n-----\n", before: { key: "value" } },
  { text: "---\n{ key: value }\n---\n", before: { key: "value" } },
  { text: "---\n&alias key: value\n---\n", before: { key: "value" } },
  { text: "---\nkey: [&alias value]\n---\n", before: { key: ["value"] } },
  {
    text: "---\nkey: &alias value\nother: *alias\n---\n",
    before: { key: "value", other: "value" },
  },
  { text: "---\n01: value\n---\n", before: { "1": "value" } },
  { text: '---\n"key":value\n---\n', before: { key: "value" } },
  { text: "---\nkey: [a,\nb]\n---\n", before: { key: ["a", "b"] } },
])("refuses uncertain write layout for %j and preserves semantic no-ops", ({ text, before }) => {
  const split = splitNoteText(text);
  expect(editNoteText(split, before, { ...before, new: "value" })).toEqual(Result.fail("layout"));
  expect(editNoteText(split, before, { ...before })).toEqual(Result.succeed(text));
});

it("compares ordered frontmatter recursively with Object.is leaves and cycle protection", () => {
  expect(
    sameFrontmatter({ list: [NaN, -0], map: { a: true } }, { list: [NaN, -0], map: { a: true } }),
  ).toBe(true);
  expect(sameFrontmatter({ list: [0] }, { list: [-0] })).toBe(false);
  expect(sameFrontmatter({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
  expect(sameFrontmatter({ map: { a: 1, b: 2 } }, { map: { b: 2, a: 1 } })).toBe(false);

  const left: Record<string, unknown> = {};
  const right: Record<string, unknown> = {};
  left.point = left;
  right.point = right;
  expect(sameFrontmatter(left, right)).toBe(true);
  right.extra = true;
  expect(sameFrontmatter(left, right)).toBe(false);
});

it("preserves all generated bytes outside a replaced entry", () => {
  const generated = fc.record({
    bom: fc.constantFrom("", "\uFEFF"),
    eol: fc.constantFrom("\n", "\r\n"),
    closer: fc.constantFrom("---", "--- \t", "----"),
    text: fc.string(),
    body: fc.string(),
  });

  fc.assert(
    fc.property(generated, ({ bom, eol, closer, text, body }) => {
      const head = bom + "---" + eol + "# keep" + eol + "version: 1.10" + eol;
      const tail = yamlEntry("unknown", text, eol) + closer + eol + body;
      const before = { version: 1.1, status: "open", unknown: text };
      const after = { ...before, status: "changed " + text };
      const document = head + "status: 'open' \t# keep this too" + eol + tail;
      expect(editNoteText(splitNoteText(document), before, after)).toEqual(
        Result.succeed(
          head +
            yamlEntry("status", after.status, eol).slice(0, -eol.length) +
            " \t# keep this too" +
            eol +
            tail,
        ),
      );
    }),
    { numRuns: 250 },
  );
});
