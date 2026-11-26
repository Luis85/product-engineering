import type { NoteFieldConflict } from "../../domain/notes";

export type ConflictChoices = Readonly<Record<string, "mine" | "current">>;

type ValueLabels = {
  readonly empty: string;
  readonly unavailable: string;
  readonly trueValue: string;
  readonly falseValue: string;
};

export function allChoicesMade(
  conflicts: readonly NoteFieldConflict[],
  choices: ConflictChoices,
): boolean {
  return (
    conflicts.length > 0 &&
    conflicts.every(({ key }) => choices[key] === "mine" || choices[key] === "current")
  );
}

export function displayConflictValue(value: unknown, labels: ValueLabels): string {
  if (value === undefined || value === null) return labels.empty;
  if (typeof value === "string") return value === "" ? '""' : value;
  if (typeof value === "boolean") return value ? labels.trueValue : labels.falseValue;
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value) ?? labels.unavailable;
  } catch {
    return labels.unavailable;
  }
}
