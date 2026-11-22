import { expect, it } from "vitest";
import { catalogFor, languageFromCode } from "../../../../src/application/messages";
import { describeIssue, PRODUCT_NAME } from "../../../../src/application/shell";
import { LOG_LEVELS } from "../../../../src/domain/shell";
import type { SettingsIssue } from "../../../../src/domain/shell";

const issues: SettingsIssue[] = [
  { code: "file.invalid" },
  { code: "schema.invalid" },
  { code: "schema.newer", version: 2 },
  { code: "migration.failed", version: 2 },
  { code: "logLevel.unknown", allowed: LOG_LEVELS },
  { code: "mcpPort.invalid" },
  { code: "claudeCodePath.invalid" },
  { code: "codexPath.invalid" },
  { code: "rootFolder.invalid", max: 100 },
];

it.each([
  ["de", "de"],
  ["DE_ch", "de"],
  ["dE-AT", "de"],
  ["deutsch", "en"],
  ["fr", "en"],
  ["en-US", "en"],
])("chooses the supported language for %s", (code, expected) => {
  expect(languageFromCode(code)).toBe(expected);
});

it("keeps both catalogs complete with the same shape", () => {
  const en = catalogFor("en").shell;
  const de = catalogFor("de").shell;
  const keyPaths = (value: unknown, prefix = ""): string[] =>
    typeof value !== "object" || value === null
      ? [prefix]
      : Object.entries(value)
          .flatMap(([key, child]: [string, unknown]) =>
            keyPaths(child, prefix ? `${prefix}.${key}` : key),
          )
          .toSorted();

  expect(keyPaths(de)).toEqual(keyPaths(en));
  expect(PRODUCT_NAME).toBe("Product Engineering");
  expect(en.actions).toEqual({
    retry: "Retry",
    "open-settings": "Open settings",
    "copy-diagnostics": "Copy diagnostics",
  });
  expect(de.actions).toEqual({
    retry: "Erneut versuchen",
    "open-settings": "Einstellungen öffnen",
    "copy-diagnostics": "Diagnose kopieren",
  });
  expect(en.settingsTab.logLevel).toEqual({
    name: "Log level",
    desc: "Choose which messages appear in the diagnostic log.",
    labels: { error: "Error", warn: "Warning", info: "Info", debug: "Debug" },
  });
  expect(de.settingsTab.logLevel).toEqual({
    name: "Protokollstufe",
    desc: "Wähle, welche Meldungen im Diagnoseprotokoll erscheinen.",
    labels: { error: "Fehler", warn: "Warnung", info: "Info", debug: "Debug" },
  });
});

it("renders every structural and field issue in both languages", () => {
  expect(issues.map((issue) => describeIssue(issue, catalogFor("en").shell.issues))).toEqual([
    "The settings file is invalid.",
    "The settings file has an invalid version.",
    "The settings file uses version 2.",
    "Settings from version 2 could not be migrated.",
    "Choose one of the available log levels (error, warn, info, debug).",
    "Enter a whole number from 0 to 65535 for the MCP port.",
    "Enter an absolute path to the Claude Code executable, or leave it blank to find it automatically.",
    "Enter an absolute path to the Codex executable, or leave it blank to find it automatically.",
    "Use a folder path of up to 100 characters without hidden or invalid folder names.",
  ]);
  expect(issues.map((issue) => describeIssue(issue, catalogFor("de").shell.issues))).toEqual([
    "Die Einstellungsdatei ist ungültig.",
    "Die Versionsnummer der Einstellungsdatei ist ungültig.",
    "Die Einstellungsdatei verwendet Version 2.",
    "Einstellungen der Version 2 konnten nicht migriert werden.",
    "Wähle eine verfügbare Protokollstufe (Fehler, Warnung, Info, Debug).",
    "Gib für den MCP-Port eine ganze Zahl von 0 bis 65535 ein.",
    "Gib den absoluten Pfad zur ausführbaren Datei von Claude Code ein oder lass das Feld für die automatische Suche leer.",
    "Gib den absoluten Pfad zur ausführbaren Datei von Codex ein oder lass das Feld für die automatische Suche leer.",
    "Verwende einen Ordnerpfad mit höchstens 100 Zeichen ohne versteckte oder ungültige Ordnernamen.",
  ]);
});
