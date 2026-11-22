import { Effect } from "effect";
import { PRODUCT_NAME } from "./i18n/catalog";
import { describeShellError } from "./i18n/describe";
import { Clipboard, HostInfo, Logger, Messages, Notifier } from "./ports";
import type { DatedLogEntry } from "./ports";
import { SettingsService } from "./settings-service";

function logLine({ timestamp, level, event, data, error, incidentId }: DatedLogEntry): string {
  const tokens = [new Date(timestamp).toISOString(), level.toUpperCase(), event];
  if (incidentId) tokens.push(incidentId);
  if (data) tokens.push(JSON.stringify(data));
  if (error) tokens.push(error.name, ...error.frames);
  return tokens.join(" ");
}

export const copyDiagnostics = Effect.gen(function* () {
  const settings = yield* SettingsService;
  const logger = yield* Logger;
  const host = yield* HostInfo;
  const { shell: messages } = yield* Messages;
  const clipboard = yield* Clipboard;
  const notifier = yield* Notifier;
  const { logLevel } = yield* settings.current;
  const status = yield* settings.status;
  const logs = yield* logger.recent;

  const report = [
    `${PRODUCT_NAME} diagnostics`,
    `Plugin version: ${host.pluginVersion}`,
    `Obsidian version: ${host.apiVersion}`,
    `Platform: ${host.platform}`,
    `UI language: ${messages.language}`,
    `Settings status: ${status.readOnlyReason ? `read-only (${status.readOnlyReason})` : "writable"}`,
    `Settings issues: ${status.issues.map(({ code }) => code).join(", ") || "none"}`,
    `Log level: ${logLevel}`,
    "Logs:",
    ...logs.map(logLine),
  ].join("\n");

  yield* Effect.matchEffect(clipboard.write(report), {
    onFailure: (error) => notifier.notify(describeShellError(error, messages)),
    onSuccess: () => notifier.notify({ severity: "info", ...messages.diagnosticsCopied }),
  });
});
