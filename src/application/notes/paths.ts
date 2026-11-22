import { Effect } from "effect";
import { clashKey, noteNameIssue } from "../../domain/notes";
import { InvalidNoteNameError, NotePathTakenError } from "./index";

export function pathsInFolder(folder: string, paths: readonly string[]): readonly string[] {
  if (folder === "/" || folder === "") return paths.toSorted();
  const prefix = folder + "/";
  return paths.filter((path) => path.startsWith(prefix)).toSorted();
}

export function planRename(
  path: string,
  newName: string,
  siblings: readonly string[],
): Effect.Effect<string, InvalidNoteNameError | NotePathTakenError> {
  const issue = noteNameIssue(newName);
  if (issue) return Effect.fail(new InvalidNoteNameError({ issue }));

  const parentEnd = path.lastIndexOf("/") + 1;
  const existing = path.slice(parentEnd);
  const filename = newName.trim().normalize("NFC") + ".md";
  const key = clashKey(filename);
  const taken = siblings.some((sibling) => sibling !== existing && clashKey(sibling) === key);
  return taken
    ? Effect.fail(new NotePathTakenError())
    : Effect.succeed(path.slice(0, parentEnd) + filename);
}
