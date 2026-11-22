import type { IntegrationsCatalog } from "./catalog";

export const en: IntegrationsCatalog = {
  language: "en",
  providers: { "claude-code": "Claude Code", codex: "Codex" },
  chatFailures: {
    "provider-not-found": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} is unavailable`,
      detail: `Install ${provider} and resend your message.`,
    }),
    "authentication-required": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} needs you to sign in`,
      detail: "Sign in through the installed CLI, then resend your message.",
    }),
    "process-failed": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} stopped before completing the response`,
      detail: "Try sending your message again.",
    }),
    "invalid-response": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} returned an unreadable response`,
      detail: "Update the installed CLI and try again.",
    }),
    "unsupported-request": (provider) => ({
      severity: "warning",
      title: `This message could not be sent to ${provider}`,
      detail: "Check the message and try again.",
    }),
    cancelled: () => ({
      severity: "info",
      title: "Response stopped",
      detail: "Send another message to continue.",
    }),
  },
};
