import { PRODUCT_NAME } from "./catalog";
import type { IssueDescriptions, ShellCatalog } from "./catalog";
import { describeIssue } from "./describe";

const issues: IssueDescriptions = {
  "file.invalid": () => "The settings file is invalid.",
  "schema.invalid": () => "The settings file has an invalid version.",
  "schema.newer": ({ version }) => `The settings file uses version ${version}.`,
  "migration.failed": ({ version }) => `Settings from version ${version} could not be migrated.`,
  "logLevel.unknown": ({ allowed }) =>
    `Choose one of the available log levels (${allowed.join(", ")}).`,
  "mcpPort.invalid": () => "Enter a whole number from 0 to 65535 for the MCP port.",
  "mcpSharedItemIds.invalid": () =>
    "Choose the items to share again in Product Engineering settings.",
  "claudeCodePath.invalid": () =>
    "Enter an absolute path to the Claude Code executable, or leave it blank to find it automatically.",
  "codexPath.invalid": () =>
    "Enter an absolute path to the Codex executable, or leave it blank to find it automatically.",
  "rootFolder.invalid": ({ max }) =>
    `Use a folder path of up to ${max} characters without hidden or invalid folder names.`,
};

export const en: ShellCatalog = {
  language: "en",
  issues,
  errors: {
    storage: { title: "Settings could not be read or saved", detail: "Try again." },
    readOnly: {
      title: "Settings are read-only",
      detail: {
        "newer-version": `This file uses a newer settings version. Update ${PRODUCT_NAME} to edit it.`,
        unreadable: "The settings file is unreadable. Check the file before editing settings.",
      },
    },
    invalidSettings: { title: "Some settings are invalid" },
    vaultRead: { title: "The vault could not be read", detail: "Try again." },
    clipboard: { title: "Diagnostics could not be copied", detail: "Try copying them again." },
  },
  defect: {
    title: `${PRODUCT_NAME} encountered a problem`,
    detail: (incidentId) => `Report incident ${incidentId} in the ${PRODUCT_NAME} GitHub issues.`,
  },
  settingsReset: {
    title: "Some settings were reset",
    detail: (values) => values.map((issue) => describeIssue(issue, issues)).join(" "),
  },
  diagnosticsCopied: {
    title: "Diagnostics copied",
    detail: "Paste the report into your support request.",
  },
  actions: {
    retry: "Retry",
    "open-settings": "Open settings",
    "copy-diagnostics": "Copy diagnostics",
  },
  commands: { openView: `Open ${PRODUCT_NAME}`, copyDiagnostics: "Copy diagnostics" },
  frame: {
    navigation: `${PRODUCT_NAME} navigation`,
    settings: "Settings",
    content: `${PRODUCT_NAME} content`,
    back: "Go back",
    forward: "Go forward",
    settingsSections: "Settings sections",
  },
  notFound: {
    title: "This page is unavailable",
    detail: `Open the ${PRODUCT_NAME} start page.`,
    back: "Back to start",
  },
  settingsTab: {
    issuesLink: "Report issues on GitHub",
    logLevel: {
      name: "Log level",
      desc: "Choose which messages appear in the diagnostic log.",
      labels: { error: "Error", warn: "Warning", info: "Info", debug: "Debug" },
    },
  },
};
