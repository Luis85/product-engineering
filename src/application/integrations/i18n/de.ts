import type { IntegrationsCatalog } from "./catalog";

export const de: IntegrationsCatalog = {
  language: "de",
  settings: {
    mcp: {
      title: "Lokaler MCP-Server",
      port: {
        name: "MCP-Port",
        desc: "Lass das Feld für die automatische Portwahl leer. Änderungen gelten beim nächsten Start.",
      },
      running: (endpoint) => `Erreichbar unter ${endpoint}.`,
      stopped: "Starte den Server, um einen lokalen MCP-Client zu verbinden.",
      start: "MCP-Server starten",
      stop: "MCP-Server stoppen",
      copy: "MCP-Verbindung kopieren",
      copied: {
        title: "MCP-Verbindung kopiert",
        detail: "Verwende diese Verbindungsdaten in deinem MCP-Client.",
      },
      errors: {
        start: {
          title: "Der MCP-Server konnte nicht gestartet werden",
          detail: "Wähle einen anderen Port oder lass das Feld leer.",
        },
        stop: {
          title: "Der MCP-Server konnte nicht gestoppt werden",
          detail: "Versuche erneut, ihn zu stoppen.",
        },
        copy: {
          title: "Die MCP-Verbindung konnte nicht kopiert werden",
          detail: "Starte den Server und versuche erneut, die Verbindung zu kopieren.",
        },
      },
    },
    ai: {
      title: "KI-Adapter",
      claudeCodePath: {
        name: "Claude-Code-Programmdatei",
        desc: "Gib einen absoluten Pfad ein oder lass das Feld für die automatische Suche leer.",
      },
      codexPath: {
        name: "Codex-Programmdatei",
        desc: "Gib einen absoluten Pfad ein oder lass das Feld für die automatische Suche leer.",
      },
    },
  },
  providers: { "claude-code": "Claude Code", codex: "Codex" },
  chat: {
    title: "KI-Chat",
    provider: "Anbieter",
    recipientHint: "Beim Senden erhält der ausgewählte Anbieter den bisherigen Gesprächsverlauf.",
    conversation: "Gespräch",
    empty: "Sende eine Nachricht, um das Gespräch zu beginnen.",
    message: "Nachricht",
    send: "Senden",
    stop: "Antwort stoppen",
    responding: "Antwort wird erstellt…",
    stopping: "Antwort wird gestoppt…",
    stopped: "Antwort gestoppt",
    speakers: { user: "Du", assistant: "Assistent" },
  },
  chatFailures: {
    "provider-not-found": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} ist nicht verfügbar`,
      detail: `Installiere ${provider} und sende deine Nachricht erneut.`,
    }),
    "authentication-required": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} erfordert eine Anmeldung`,
      detail: "Melde dich in der installierten CLI an und sende deine Nachricht erneut.",
    }),
    "process-failed": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} wurde vor Abschluss der Antwort beendet`,
      detail: "Versuche, deine Nachricht erneut zu senden.",
    }),
    "invalid-response": (provider) => ({
      severity: "error",
      action: "retry",
      title: `${provider} hat eine unlesbare Antwort zurückgegeben`,
      detail: "Aktualisiere die installierte CLI und versuche es erneut.",
    }),
    "unsupported-request": (provider) => ({
      severity: "warning",
      title: `Diese Nachricht konnte nicht an ${provider} gesendet werden`,
      detail: "Prüfe die Nachricht und versuche es erneut.",
    }),
    cancelled: () => ({
      severity: "info",
      title: "Antwort gestoppt",
      detail: "Sende eine weitere Nachricht, um fortzufahren.",
    }),
  },
};
