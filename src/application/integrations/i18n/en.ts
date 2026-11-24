import type { IntegrationsCatalog } from "./catalog";

export const en: IntegrationsCatalog = {
  language: "en",
  settings: {
    mcp: {
      title: "Local MCP server",
      port: {
        name: "MCP port",
        desc: "Leave blank to choose a port automatically. Changes apply the next time the server starts.",
      },
      running: (endpoint) => `Listening at ${endpoint}.`,
      stopped: "Start the server to connect a local MCP client.",
      start: "Start MCP server",
      stop: "Stop MCP server",
      copy: "Copy MCP connection",
      copied: {
        title: "MCP connection copied",
        detail: "Use these connection details in your MCP client.",
      },
      sharing: {
        title: "Items shared with MCP clients",
        description:
          "Choose the items clients can read. New selections take effect at the next server start. Removing a selection withdraws access immediately.",
        loading: "Loading items…",
        unavailable: "The item index is unavailable.",
        empty: "No items are available to share.",
        unavailableItem: "Unavailable item",
      },
      errors: {
        start: {
          title: "The MCP server could not start",
          detail: "Use a different port or leave the port blank.",
        },
        stop: { title: "The MCP server could not stop", detail: "Try stopping it again." },
        copy: {
          title: "The MCP connection could not be copied",
          detail: "Start the server and try copying the connection again.",
        },
      },
    },
    ai: {
      title: "AI Copilot",
      enabled: {
        name: "Enable AI Copilot",
        desc: "Copilot helps with questions, drafts, and reviews. This setting applies to every project.",
      },
      connection: "Model connection",
      mode: {
        name: "Execution mode",
        desc: "This mode applies to every product project.",
      },
      modes: { demo: "Local demo", codex: "Codex (CLI)", "claude-code": "Claude Code (CLI)" },
      destination: "Data transfer",
      disclosure: (mode) => {
        if (mode === "demo")
          return "Local demo produces example responses on this device. Project data stays here.";
        const provider = en.providers[mode];
        return `When you send a request, ${provider} receives your input, the conversation history used and your selected project sources. The CLI runs locally, manages its own sign-in, and may send remote requests.`;
      },
      claudeCodePath: {
        name: "Claude Code executable",
        desc: "Use an absolute path or leave blank for automatic discovery.",
      },
      codexPath: {
        name: "Codex executable",
        desc: "Use an absolute path or leave blank for automatic discovery.",
      },
    },
  },
  providers: { "claude-code": "Claude Code", codex: "Codex", demo: "Local demo" },
  chat: {
    title: "AI chat",
    demoReply: "This is a sample response from the local demo.",
    correctExecutable: "Correct the executable in Settings",
    conversation: "Conversation",
    empty: "Send a message to start the conversation.",
    message: "Message",
    send: "Send",
    stop: "Stop response",
    responding: "Responding…",
    stopping: "Stopping…",
    stopped: "Response stopped",
    speakers: { user: "You", assistant: "Assistant" },
  },
  chatFailures: {
    "consent-required": () => ({
      severity: "warning",
      title: "AI is disabled",
      detail: "AI chat requires your explicit consent.",
    }),
    "provider-not-found": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} is unavailable`,
      detail: `Check the ${provider} executable or install the CLI, then resend your message.`,
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
