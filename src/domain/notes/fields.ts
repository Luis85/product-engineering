import { Result, Schema } from "effect";

export interface Field<Value, Issue extends string> {
  readonly check: (input: unknown) => Result.Result<Value, Issue>;
}

type KindIssue = `field.${"text" | "number" | "checkbox" | "date" | "list"}`;
export type CoreFieldIssue = KindIssue | "field.missing";

interface NarrowRule<Value, Issue extends string> {
  readonly schema: Schema.Codec<Value, unknown>;
  readonly issue: Issue;
}

function fieldKind<Value, const Kind extends KindIssue>(
  schema: Schema.Codec<Value, unknown>,
  issue: Kind,
) {
  const checkKind = Schema.decodeUnknownResult(schema);

  function field(): Field<Value | undefined, Kind>;
  function field<Checked extends Value, const Issue extends string>(
    rule: NarrowRule<Checked, Issue>,
  ): Field<Checked | undefined, Kind | Issue>;
  function field<Checked extends Value, Issue extends string>(
    rule?: NarrowRule<Checked, Issue>,
  ): Field<Value | undefined, Kind | Issue> {
    const narrow =
      rule === undefined
        ? undefined
        : { check: Schema.decodeUnknownResult(rule.schema), issue: rule.issue };
    return {
      check(input) {
        if (input === undefined || input === null) return Result.succeed(undefined);
        const kind = checkKind(input);
        if (Result.isFailure(kind)) return Result.fail(issue);
        if (narrow === undefined) return Result.succeed(kind.success);
        const checked = narrow.check(kind.success);
        return Result.isFailure(checked)
          ? Result.fail(narrow.issue)
          : Result.succeed(checked.success);
      },
    };
  }

  return field;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const text = fieldKind(Schema.String, "field.text");
export const number = fieldKind(Schema.Finite, "field.number");
export const checkbox = fieldKind(Schema.Boolean, "field.checkbox");
export const date = fieldKind(Schema.String.check(Schema.makeFilter(isCalendarDate)), "field.date");
export const list = fieldKind(Schema.Array(Schema.String), "field.list");

export function isControlCharacter(value: string): boolean {
  return /\p{Cc}/u.test(value);
}

export function lineOfText(max: number) {
  return Schema.String.check(
    Schema.isMaxLength(max),
    Schema.makeFilter(
      (value: string) => !isControlCharacter(value) && !/[\u2028\u2029]/u.test(value),
    ),
  );
}

export function required<Value, Issue extends string>(
  field: Field<Value | undefined, Issue>,
): Field<Value, Issue | "field.missing"> {
  return {
    check(input) {
      const checked = field.check(input);
      if (Result.isFailure(checked)) return Result.fail(checked.failure);
      return checked.success === undefined
        ? Result.fail("field.missing")
        : Result.succeed(checked.success);
    },
  };
}
