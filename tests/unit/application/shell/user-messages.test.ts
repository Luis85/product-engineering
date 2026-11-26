import * as fc from "fast-check";
import { expect, it } from "vitest";
import { catalogFor } from "../../../../src/application/messages";
import {
  ClipboardError,
  InvalidSettingsError,
  ReadOnlySettingsError,
  StorageError,
  VaultReadError,
} from "../../../../src/application/shell";
import { describeError } from "../../../../src/application/user-messages";
import type { AppError } from "../../../../src/application/errors";

const errors: readonly AppError[] = [
  new StorageError(),
  new ReadOnlySettingsError({ reason: "newer-version" }),
  new ReadOnlySettingsError({ reason: "unreadable" }),
  new InvalidSettingsError({ issues: [{ code: "file.invalid" }] }),
  new VaultReadError(),
  new ClipboardError(),
];

it("describes each tagged error in English", () => {
  const messages = errors.map((error) => describeError(error, catalogFor("en")));
  expect(messages).toEqual([
    {
      severity: "error",
      action: "retry",
      title: "Settings could not be read or saved",
      detail: "Try again.",
    },
    {
      severity: "warning",
      action: "open-settings",
      title: "Settings are read-only",
      detail: "This file uses a newer settings version. Update Product Engineering to edit it.",
    },
    {
      severity: "warning",
      action: "open-settings",
      title: "Settings are read-only",
      detail: "The settings file is unreadable. Check the file before editing settings.",
    },
    {
      severity: "warning",
      action: "open-settings",
      title: "Some settings are invalid",
      detail: "The settings file is invalid.",
    },
    {
      severity: "error",
      action: "retry",
      title: "The vault could not be read",
      detail: "Try again.",
    },
    {
      severity: "error",
      action: "copy-diagnostics",
      title: "Diagnostics could not be copied",
      detail: "Try copying them again.",
    },
  ]);
});

it("describes each tagged error in German with the same actions", () => {
  const messages = errors.map((error) => describeError(error, catalogFor("de")));
  expect(messages.map(({ title, detail }) => [title, detail])).toEqual([
    ["Einstellungen konnten nicht gelesen oder gespeichert werden", "Versuche es erneut."],
    [
      "Einstellungen sind schreibgeschützt",
      "Die Datei verwendet eine neuere Einstellungsversion. Aktualisiere Product Engineering, um sie zu bearbeiten.",
    ],
    [
      "Einstellungen sind schreibgeschützt",
      "Die Einstellungsdatei ist nicht lesbar. Prüfe die Datei, bevor du Einstellungen bearbeitest.",
    ],
    ["Einige Einstellungen sind ungültig", "Die Einstellungsdatei ist ungültig."],
    ["Der Vault konnte nicht gelesen werden", "Versuche es erneut."],
    ["Die Diagnose konnte nicht kopiert werden", "Versuche, sie erneut zu kopieren."],
  ]);
  expect(messages.map(({ action, severity }) => [action, severity])).toEqual(
    errors.map((error) => {
      const { action, severity } = describeError(error, catalogFor("en"));
      return [action, severity];
    }),
  );
});

it("keeps raw causes out of localized expected-failure messages", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const cause = `private:${input}`;
      const failures = [
        new StorageError({ cause }),
        new VaultReadError({ cause }),
        new ClipboardError({ cause }),
      ];
      for (const language of ["en", "de"] as const) {
        for (const error of failures) {
          const { title, detail } = describeError(error, catalogFor(language));
          const text = `${title} ${detail}`;
          expect(text).not.toContain(cause);
          expect(text).not.toMatch(/Error|stack|[\\/]/);
        }
      }
    }),
  );
});
