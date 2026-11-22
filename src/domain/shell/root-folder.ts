import { Schema, SchemaGetter } from "effect";

export const DEFAULT_ROOT_FOLDER = "Product Engineering";
export const ROOT_FOLDER_MAX_LENGTH = 100;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

function validSegment(segment: string): boolean {
  return (
    segment.trim() !== "" &&
    !segment.startsWith(".") &&
    !/[*"\\<>:|?]/.test(segment) &&
    !hasControlCharacter(segment)
  );
}

const FolderPath = Schema.String.check(
  Schema.isMaxLength(ROOT_FOLDER_MAX_LENGTH),
  Schema.makeFilter((path) => path.split("/").every(validSegment)),
);

export const RootFolder = Schema.String.pipe(
  Schema.decodeTo(FolderPath, {
    decode: SchemaGetter.transform((path) =>
      path
        .trim()
        .replace(/^\/+|\/+$/g, "")
        .trim()
        .normalize("NFC"),
    ),
    encode: SchemaGetter.passthrough(),
  }),
);
