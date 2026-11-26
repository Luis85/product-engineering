import { sameFrontmatterValue } from "./frontmatter-equality";
import type { Frontmatter, NoteFields, NoteType } from "./note-type";

export type FormInput = Readonly<Record<string, unknown>>;
export type FormDraft = FormInput;

function trimDraftValue(value: unknown): unknown {
  return typeof value === "string" ? value.trim() || undefined : value;
}

function ownValue(input: FormInput, key: string): unknown {
  return Object.hasOwn(input, key) ? input[key] : undefined;
}

export function trimmedValues(input: FormInput): Frontmatter {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, trimDraftValue(value)]),
  );
}

export function editedValues<Fields extends NoteFields>(
  type: NoteType<Fields>,
  input: FormInput,
  draft: FormDraft,
  loaded: Frontmatter,
): Frontmatter {
  return Object.fromEntries(
    type.keys.map((key) => {
      const value = ownValue(input, key);
      return [
        key,
        sameFrontmatterValue(value, ownValue(draft, key))
          ? ownValue(loaded, key)
          : trimDraftValue(value),
      ];
    }),
  );
}
