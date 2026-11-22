import { Result, Schema } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import {
  checkbox,
  date,
  list,
  number,
  required,
  text,
  type Field,
} from "../../../../src/domain/notes/fields";

it.each([
  { field: text(), values: ["", " text ", "☃"], bad: [1, {}, false], issue: "field.text" },
  {
    field: number(),
    values: [0, -0, -1.5],
    bad: ["3", NaN, Infinity, -Infinity],
    issue: "field.number",
  },
  { field: checkbox(), values: [true, false], bad: ["true", 1, 0], issue: "field.checkbox" },
  {
    field: date(),
    values: ["2000-02-29", "2024-02-29", "2025-12-31"],
    bad: [
      "1900-02-29",
      "2025-02-29",
      "2024-02-30",
      "2025-1-01",
      "2025-01-1",
      "2025-00-15",
      "2025-13-01",
      "2025-11-31",
      "2025-04-00",
      "2025-01-01\n",
      new Date("2025-01-01"),
    ],
    issue: "field.date",
  },
  {
    field: list(),
    values: [[], ["", "tag"]],
    bad: [["tag", 2], [null], "tag", { 0: "tag" }],
    issue: "field.list",
  },
])("checks Obsidian values for $issue", ({ field, values, bad, issue }) => {
  for (const value of values) expect(field.check(value)).toEqual(Result.succeed(value));
  for (const value of bad) expect(field.check(value)).toEqual(Result.fail(issue));
  expect(field.check(undefined)).toEqual(Result.succeed(undefined));
  expect(field.check(null)).toEqual(Result.succeed(undefined));
});

it("requires present values without treating valid falsy values as empty", () => {
  expect(required(text()).check(null)).toEqual(Result.fail("field.missing"));
  expect(required(date()).check(undefined)).toEqual(Result.fail("field.missing"));
  expect(required(text()).check(0)).toEqual(Result.fail("field.text"));
  expect(required(text()).check("")).toEqual(Result.succeed(""));
  expect(required(number()).check(0)).toEqual(Result.succeed(0));
  expect(required(checkbox()).check(false)).toEqual(Result.succeed(false));
  expect(required(list()).check([])).toEqual(Result.succeed([]));
});

it("reports the narrower rule only after seeing a value of the declared kind", () => {
  const status = text({ schema: Schema.Literals(["open", "closed"]), issue: "status.invalid" });
  expectTypeOf(status).toEqualTypeOf<
    Field<"open" | "closed" | undefined, "field.text" | "status.invalid">
  >();
  expectTypeOf(required(status)).toEqualTypeOf<
    Field<"open" | "closed", "field.text" | "status.invalid" | "field.missing">
  >();
  expect(status.check("open")).toEqual(Result.succeed("open"));
  expect(status.check("archived")).toEqual(Result.fail("status.invalid"));
  expect(status.check(1)).toEqual(Result.fail("field.text"));
  expect(status.check(null)).toEqual(Result.succeed(undefined));
  expect(required(status).check(undefined)).toEqual(Result.fail("field.missing"));
  expect(required(number({ schema: Schema.Int, issue: "count.invalid" })).check(1.5)).toEqual(
    Result.fail("count.invalid"),
  );
});
