import { expect, it } from "vitest";
import {
  InvalidNoteNameError,
  NoteNotFoundError,
  NotePathTakenError,
  NoteTrashError,
  NoteUnreadableError,
  NoteWriteError,
  notesModule,
} from "../../../../src/application/notes";

it("gives each tagged error a localized message without a vault path", () => {
  const errors = [
    new NoteNotFoundError(),
    new NotePathTakenError(),
    new NoteUnreadableError(),
    new NoteWriteError(),
    new NoteTrashError(),
    new InvalidNoteNameError({ issue: "leading-dot" }),
  ];
  for (const language of ["en", "de"] as const) {
    const messages = errors.map((error) =>
      notesModule.errors.describe(error, notesModule.catalog[language]),
    );
    expect(messages.every((message) => message.title.length > 0 && message.detail.length > 0)).toBe(
      true,
    );
    expect(messages.every((message) => !message.detail.includes("/"))).toBe(true);
  }
  expect(notesModule.errors.describe(new NoteTrashError(), notesModule.catalog.en).title).toBe(
    "Could not delete the note",
  );
  expect(notesModule.errors.describe(new NoteWriteError(), notesModule.catalog.en).title).toBe(
    "Could not save the note",
  );
});
