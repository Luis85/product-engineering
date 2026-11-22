import { expect, it } from "vitest";
import {
  InvalidNoteNameError,
  NoteNotFoundError,
  NotePathTakenError,
  NoteTrashError,
  NoteUnreadableError,
  NoteWriteError,
  NoteWriteRefusedError,
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

it.each([
  "other-type",
  "newer-version",
  "identity",
  "duplicate-id",
  "migration-failed",
  "layout",
] as const)("localizes the %s write refusal", (reason) => {
  const refusal = new NoteWriteRefusedError({ reason });
  const en = notesModule.errors.describe(refusal, notesModule.catalog.en);
  const de = notesModule.errors.describe(refusal, notesModule.catalog.de);
  expect(en.severity).toBe("warning");
  expect(de.severity).toBe("warning");
  expect(en.detail.length).toBeGreaterThan(0);
  expect(de.detail.length).toBeGreaterThan(0);
  expect(en.detail).not.toBe(de.detail);
});
