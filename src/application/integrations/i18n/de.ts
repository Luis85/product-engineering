import type { IntegrationsCatalog } from "./catalog";

export const de: IntegrationsCatalog = {
  language: "de",
  providers: { "claude-code": "Claude Code", codex: "Codex" },
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
