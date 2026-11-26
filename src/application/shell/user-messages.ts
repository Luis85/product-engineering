export type UserMessageAction = "retry" | "open-settings" | "copy-diagnostics";

export type UserMessage = {
  readonly severity: "info" | "warning" | "error";
  readonly title: string;
  readonly detail: string;
  readonly action?: UserMessageAction;
  readonly link?: string;
};
