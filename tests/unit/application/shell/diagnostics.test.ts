import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { copyDiagnostics, Logger, setLogLevel } from "../../../../src/application/shell";
import { shellFixture } from "../../../support/layers";

it.effect("copies the fixed-language report and sends a localized confirmation", () => {
  const fixture = shellFixture();
  return Effect.gen(function* () {
    yield* setLogLevel("info");
    const logger = yield* Logger;
    yield* logger.log({ level: "warn", event: "plugin.loaded", data: { ready: true } });
    yield* copyDiagnostics;
    expect(fixture.clipboard).toEqual([
      [
        "Product Engineering diagnostics",
        "Plugin version: 0.1.0",
        "Obsidian version: 1.15.1",
        "Platform: Windows",
        "UI language: de",
        "Settings status: writable",
        "Settings issues: none",
        "Log level: info",
        "Logs:",
        '1970-01-01T00:00:00.000Z WARN plugin.loaded {"ready":true}',
      ].join("\n"),
    ]);
    expect(fixture.notices).toEqual([
      {
        severity: "info",
        title: "Diagnose kopiert",
        detail: "Füge den Bericht in deine Supportanfrage ein.",
      },
    ]);

    fixture.failClipboard();
    yield* copyDiagnostics;
    expect(fixture.clipboard).toHaveLength(1);
    expect(fixture.notices.at(-1)).toMatchObject({
      action: "copy-diagnostics",
      title: "Die Diagnose konnte nicht kopiert werden",
    });
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("puts read-only status and issue codes into the report", () => {
  const fixture = shellFixture({ schemaVersion: 2, logLevel: "debug" });
  return Effect.gen(function* () {
    yield* copyDiagnostics;
    expect(fixture.clipboard[0]).toContain(
      "Settings status: read-only (newer-version)\nSettings issues: schema.newer",
    );
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("reports settings issues and confirms the copy in English", () => {
  const fixture = shellFixture({ logLevel: "verbose" }, { language: "en" });
  return Effect.gen(function* () {
    yield* copyDiagnostics;
    expect(fixture.clipboard[0]).toContain(
      "UI language: en\nSettings status: writable\nSettings issues: logLevel.unknown",
    );
    expect(fixture.notices).toEqual([
      {
        severity: "warning",
        action: "open-settings",
        title: "Some settings were reset",
        detail: "Choose one of the available log levels (error, warn, info, debug).",
      },
      {
        severity: "info",
        title: "Diagnostics copied",
        detail: "Paste the report into your support request.",
      },
    ]);
  }).pipe(Effect.provide(fixture.layer));
});
