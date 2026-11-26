import { expect, it } from "vitest";
import { catalogFor } from "../../../src/application/messages";
import { describeError } from "../../../src/application/user-messages";
import { ProviderChatError } from "../../../src/application/integrations/chat";
import { describeProviderChatError } from "../../../src/application/integrations/i18n/catalog";
import { de } from "../../../src/application/integrations/i18n/de";
import { en } from "../../../src/application/integrations/i18n/en";

it("uses the selected provider's CLI in the authentication instruction", () => {
  expect(
    describeProviderChatError(
      new ProviderChatError({ reason: "authentication-required", provider: "claude-code" }),
      en,
    ),
  ).toEqual({
    severity: "error",
    action: "retry",
    title: "Claude Code needs you to sign in",
    detail: "Sign in through the installed CLI, then resend your message.",
  });
});

it("registers provider failures with the application error catalog", () => {
  const error = new ProviderChatError({ reason: "provider-not-found", provider: "codex" });
  expect(describeError(error, catalogFor("en"))).toMatchObject({
    title: "Codex is unavailable",
    detail: "Check the Codex executable or install the CLI, then resend your message.",
  });
  expect(describeError(error, catalogFor("de")).title).toBe("Codex ist nicht verfügbar");
});

it("describes a missing CLI and a cancellation in German", () => {
  expect(
    describeProviderChatError(
      new ProviderChatError({ reason: "provider-not-found", provider: "codex" }),
      de,
    ),
  ).toMatchObject({
    severity: "error",
    title: "Codex ist nicht verfügbar",
    detail:
      "Prüfe die Programmdatei für Codex oder installiere die CLI. Sende danach deine Nachricht erneut.",
  });
  expect(
    describeProviderChatError(
      new ProviderChatError({ reason: "cancelled", provider: "codex" }),
      de,
    ),
  ).toEqual({
    severity: "info",
    title: "Antwort gestoppt",
    detail: "Sende eine weitere Nachricht, um fortzufahren.",
  });
});

it.each([
  ["provider-not-found", "Codex is unavailable", "Codex ist nicht verfügbar"],
  ["authentication-required", "Codex needs you to sign in", "Codex erfordert eine Anmeldung"],
  [
    "process-failed",
    "Codex stopped before completing the response",
    "Codex wurde vor Abschluss der Antwort beendet",
  ],
  [
    "invalid-response",
    "Codex returned an unreadable response",
    "Codex hat eine unlesbare Antwort zurückgegeben",
  ],
  [
    "unsupported-request",
    "This message could not be sent to Codex",
    "Diese Nachricht konnte nicht an Codex gesendet werden",
  ],
  ["cancelled", "Response stopped", "Antwort gestoppt"],
] as const)("has a localized message for %s", (reason, english, german) => {
  const error = new ProviderChatError({ reason, provider: "codex" });
  expect(describeProviderChatError(error, en).title).toBe(english);
  expect(describeProviderChatError(error, de).title).toBe(german);
});
