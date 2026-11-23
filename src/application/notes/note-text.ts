import { Result } from "effect";
import { editNoteText, frontmatterYaml, sameFrontmatter, splitNoteText } from "../../domain/notes";
import type { Frontmatter, SplitNoteText } from "../../domain/notes";
import { NoteUnreadableError, NoteWriteRefusedError } from "./index";
import type { FrontmatterChange } from "./index";
import { applyPatch } from "./patch";

export { newNoteText } from "../../domain/notes";

type ParseYaml = (yaml: string) => unknown;
type UpdatedNoteText = { readonly text: string; readonly frontmatter: Frontmatter };

function isMapping(value: unknown): value is Frontmatter {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readFrontmatter(
  split: SplitNoteText,
  parseYaml: ParseYaml,
): Result.Result<Frontmatter, NoteUnreadableError> {
  const yaml = frontmatterYaml(split);
  if (yaml === undefined || yaml.split(/\r\n|\n|\r/).every((line) => /^[ \t]*(?:#|$)/.test(line))) {
    return Result.succeed({});
  }
  try {
    const parsed = parseYaml(yaml);
    return isMapping(parsed) ? Result.succeed(parsed) : Result.fail(new NoteUnreadableError());
  } catch {
    return Result.fail(new NoteUnreadableError());
  }
}

export function readNoteFrontmatter(text: string, parseYaml: ParseYaml) {
  return readFrontmatter(splitNoteText(text), parseYaml);
}

export function updateNoteText<E>(
  text: string,
  change: FrontmatterChange<E>,
  parseYaml: ParseYaml,
): Result.Result<UpdatedNoteText, E | NoteUnreadableError | NoteWriteRefusedError> {
  const source = splitNoteText(text);
  const before = readFrontmatter(source, parseYaml);
  if (Result.isFailure(before)) return Result.fail(before.failure);
  const patch = change(structuredClone(before.success));
  if (Result.isFailure(patch)) return Result.fail(patch.failure);

  const next = applyPatch(before.success, patch.success);
  const edited = editNoteText(source, before.success, next);
  if (Result.isFailure(edited)) return refused();

  const parsed =
    edited.success === text ? before : readFrontmatter(splitNoteText(edited.success), parseYaml);
  if (Result.isFailure(parsed) || !sameFrontmatter(parsed.success, next)) return refused();
  return Result.succeed({ text: edited.success, frontmatter: parsed.success });
}

function refused(): Result.Result<never, NoteWriteRefusedError> {
  return Result.fail(new NoteWriteRefusedError({ reason: "layout" }));
}
