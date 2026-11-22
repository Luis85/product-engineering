import type { ReadOnlyReason, SettingsIssue } from "../../../domain/shell";
import type { ShellError } from "../errors";
import type { SettingsStatus } from "../settings-service";
import type { UserMessage } from "../user-messages";
import { ISSUES_URL } from "./catalog";
import type { IssueDescriptions, ShellCatalog } from "./catalog";

export function describeIssue(issue: SettingsIssue, messages: IssueDescriptions): string {
  switch (issue.code) {
    case "file.invalid":
      return messages["file.invalid"](issue);
    case "schema.invalid":
      return messages["schema.invalid"](issue);
    case "schema.newer":
      return messages["schema.newer"](issue);
    case "migration.failed":
      return messages["migration.failed"](issue);
    case "logLevel.unknown":
      return messages["logLevel.unknown"](issue);
    case "mcpPort.invalid":
      return messages["mcpPort.invalid"](issue);
    case "claudeCodePath.invalid":
      return messages["claudeCodePath.invalid"](issue);
    case "codexPath.invalid":
      return messages["codexPath.invalid"](issue);
    case "rootFolder.invalid":
      return messages["rootFolder.invalid"](issue);
  }
}

function describeReadOnly(reason: ReadOnlyReason, messages: ShellCatalog): UserMessage {
  return {
    severity: "warning",
    title: messages.errors.readOnly.title,
    detail: messages.errors.readOnly.detail[reason],
    action: "open-settings",
  };
}

export function describeShellError(error: ShellError, messages: ShellCatalog): UserMessage {
  switch (error._tag) {
    case "StorageError":
      return { severity: "error", action: "retry", ...messages.errors.storage };
    case "ReadOnlySettingsError":
      return describeReadOnly(error.reason, messages);
    case "InvalidSettingsError":
      return {
        severity: "warning",
        action: "open-settings",
        title: messages.errors.invalidSettings.title,
        detail: messages.settingsReset.detail(error.issues),
      };
    case "VaultReadError":
      return { severity: "error", action: "retry", ...messages.errors.vaultRead };
    case "ClipboardError":
      return { severity: "error", action: "copy-diagnostics", ...messages.errors.clipboard };
  }
}

export function describeSettingsStatus(
  status: SettingsStatus,
  messages: ShellCatalog,
): UserMessage | undefined {
  if (status.readOnlyReason) return describeReadOnly(status.readOnlyReason, messages);
  if (status.issues.length === 0) return;
  return {
    severity: "warning",
    action: "open-settings",
    title: messages.settingsReset.title,
    detail: messages.settingsReset.detail(status.issues),
  };
}

export function describeDefect(incidentId: string, messages: ShellCatalog): UserMessage {
  return {
    severity: "error",
    title: messages.defect.title,
    detail: messages.defect.detail(incidentId),
    link: ISSUES_URL,
  };
}
