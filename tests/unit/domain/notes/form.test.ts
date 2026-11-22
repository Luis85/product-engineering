import { Result } from "effect";
import { expect, it } from "vitest";
import {
  defineNoteType,
  editedValues,
  lineOfText,
  required,
  text,
  trimmedValues,
} from "../../../../src/domain/notes";
import { testNoteType } from "../../../support/notes/test-note-type";

it("validates one line of text with the declared maximum and issue code", () => {
  const field = required(text({ schema: lineOfText(5), issue: "title.invalid" }));
  expect(field.check(" é中 ")).toEqual(Result.succeed(" é中 "));
  expect(field.check(undefined)).toEqual(Result.fail("field.missing"));
  expect(field.check(12)).toEqual(Result.fail("field.text"));
  for (const invalid of ["abcdef", "a\rb", "a\nb", "a\tb", "a\u2028b", "a\u2029b", "a\u0085b"]) {
    expect(field.check(invalid)).toEqual(Result.fail("title.invalid"));
  }
});

it("trims draft strings and treats a blank input as a clear", () => {
  const tags = [" Rich tag ", ""];
  const input = { title: "  Current value  ", empty: "   \n", done: false, points: 0, tags };
  const trimmed = trimmedValues(input);
  expect(trimmed).toEqual({
    title: "Current value",
    empty: undefined,
    done: false,
    points: 0,
    tags,
  });
  expect(trimmed.tags).toBe(tags);
  expect(input.title).toBe("  Current value  ");
});

it("keeps the exact loaded value when its rendered draft did not change", () => {
  const loaded = {
    title: "  Existing  ",
    points: 7,
    done: false,
    due: "2026-11-22",
    tags: [" value "],
  };
  const draft = { title: "Existing", points: "7", done: false, due: "2026-11-22", tags: ["value"] };
  const input = { ...draft, tags: ["value"] };
  const edited = editedValues(testNoteType, input, draft, loaded);
  expect(edited).toEqual(loaded);
  expect(edited.tags).toBe(loaded.tags);
});

it("only submits declared fields, taking changed input with form whitespace removed", () => {
  const loaded = { title: "  Original  ", points: 7, done: false, tags: ["Alpha"] };
  const draft = { title: "Original", points: 7, done: false, tags: ["Alpha"] };
  const input = {
    title: "  Renamed  ",
    points: " ",
    done: true,
    tags: ["Beta"],
    schema: "foreign",
  };
  expect(editedValues(testNoteType, input, draft, loaded)).toEqual({
    title: "Renamed",
    points: undefined,
    done: true,
    due: undefined,
    tags: ["Beta"],
  });
});

it("treats inherited properties as unset form values", () => {
  const type = defineNoteType({
    type: "example",
    version: 1,
    fields: { constructor: text() },
    migrations: {},
  });
  const values = editedValues(type, {}, {}, {});
  expect(Object.keys(values)).toEqual(["constructor"]);
  expect(values.constructor).toBeUndefined();
});
