import type { LogLevel, ReadOnlyReason, SettingsIssue } from "../../../domain/shell";
import type { UserMessageAction } from "../user-messages";

export const LANGUAGES = ["en", "de"] as const;
export const PRODUCT_NAME = "Product Engineering";
export const ISSUES_URL = "https://github.com/Luis85/product-engineering/issues";
export type Language = (typeof LANGUAGES)[number];

export type IssueDescriptions = {
  readonly [Issue in SettingsIssue as Issue["code"]]: (issue: Issue) => string;
};

type Text = { readonly title: string; readonly detail: string };

export interface ShellCatalog {
  readonly language: Language;
  readonly issues: IssueDescriptions;
  readonly errors: {
    readonly storage: Text;
    readonly readOnly: {
      readonly title: string;
      readonly detail: Readonly<Record<ReadOnlyReason, string>>;
    };
    readonly invalidSettings: { readonly title: string };
    readonly vaultRead: Text;
    readonly clipboard: Text;
  };
  readonly defect: { readonly title: string; readonly detail: (incidentId: string) => string };
  readonly settingsReset: {
    readonly title: string;
    readonly detail: (issues: readonly SettingsIssue[]) => string;
  };
  readonly diagnosticsCopied: Text;
  readonly actions: Readonly<Record<UserMessageAction, string>>;
  readonly commands: { readonly openView: string; readonly copyDiagnostics: string };
  readonly settingsTab: {
    readonly issuesLink: string;
    readonly logLevel: {
      readonly name: string;
      readonly desc: string;
      readonly labels: Readonly<Record<LogLevel, string>>;
    };
  };
}
