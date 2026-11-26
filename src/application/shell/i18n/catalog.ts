import type { LogLevel, ReadOnlyReason, SettingsIssue } from "../../../domain/shell";
import type { UserMessageAction } from "../user-messages";

export const LANGUAGES = ["en", "de"] as const;
export const PRODUCT_NAME = "Product Engineering";
export const ISSUES_URL = "https://github.com/Luis85/product-engineering/issues";
export type Language = (typeof LANGUAGES)[number];

export type SettingsIssueByCode = {
  readonly [Issue in SettingsIssue as Issue["code"]]: Issue;
};

export type IssueDescriptions = {
  readonly [Code in keyof SettingsIssueByCode]: (issue: SettingsIssueByCode[Code]) => string;
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
  readonly frame: {
    readonly navigation: string;
    readonly settings: string;
    readonly content: string;
    readonly back: string;
    readonly forward: string;
    readonly settingsSections: string;
  };
  readonly notFound: {
    readonly title: string;
    readonly detail: string;
    readonly back: string;
  };
  readonly settingsTab: {
    readonly issuesLink: string;
    readonly logLevel: {
      readonly name: string;
      readonly desc: string;
      readonly labels: Readonly<Record<LogLevel, string>>;
    };
  };
}
