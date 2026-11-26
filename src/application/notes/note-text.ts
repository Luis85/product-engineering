import { Result } from "effect";
import { editNoteText, frontmatterYaml, sameFrontmatter, splitNoteText } from "../../domain/notes";
import type { Frontmatter, SplitNoteText } from "../../domain/notes";
import { NoteUnreadableError, NoteWriteRefusedError } from "./index";
import type { FrontmatterChange, NoteContentChange } from "./index";
import { applyPatch } from "./patch";

export { newNoteText } from "../../domain/notes";

type ParseYaml = (yaml: string) => unknown;

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
) {
  return Result.map(
    updateNoteContent(text, patchContent(change), parseYaml),
    ({ text: updated, frontmatter }) => ({ text: updated, frontmatter }),
  );
}

export function patchContent<E>(change: FrontmatterChange<E>): NoteContentChange<E> {
  return ({ frontmatter }) => Result.map(change(frontmatter), (patch) => ({ patch }));
}

export function updateNoteContent<E>(
  text: string,
  change: NoteContentChange<E>,
  parseYaml: ParseYaml,
): Result.Result<
  { readonly text: string; readonly frontmatter: Frontmatter; readonly body: string },
  E | NoteUnreadableError | NoteWriteRefusedError
> {
  const source = splitNoteText(text);
  const before = readFrontmatter(source, parseYaml);
  if (Result.isFailure(before)) return Result.fail(before.failure);
  const changed = change({ frontmatter: structuredClone(before.success), body: source.body, text });
  if (Result.isFailure(changed)) return Result.fail(changed.failure);
  const { patch, body } = changed.success;

  const next = applyPatch(before.success, patch);
  const edited = editNoteText(source, before.success, next);
  if (Result.isFailure(edited)) return refused();

  const updated = updateBody(edited.success, body);
  if (Result.isFailure(updated)) return Result.fail(updated.failure);
  const target = updated.success;
  const written = splitNoteText(target);
  const parsed = target === text ? before : readFrontmatter(written, parseYaml);
  if (Result.isFailure(parsed) || !sameFrontmatter(parsed.success, next)) return refused();
  return Result.succeed({ text: target, frontmatter: parsed.success, body: written.body });
}

function updateBody(text: string, body: string | undefined) {
  if (body === undefined) return Result.succeed(text);
  const source = splitNoteText(text);
  if (body === source.body) return Result.succeed(text);
  return source.layoutSupported ? Result.succeed(replaceBody(source, body)) : refused();
}

function replaceBody(source: SplitNoteText, body: string) {
  const prefix = source.text.slice(0, source.text.length - source.body.length);
  const separator = source.frontmatter && body && !prefix.endsWith("\n") ? source.eol : "";
  return prefix + separator + body.replace(/\r\n|\r|\n/g, source.eol);
}

function refused(): Result.Result<never, NoteWriteRefusedError> {
  return Result.fail(new NoteWriteRefusedError({ reason: "layout" }));
}
