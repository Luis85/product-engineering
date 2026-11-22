import { PRODUCT_NAME } from "./catalog";
import type { IssueDescriptions, ShellCatalog } from "./catalog";
import { describeIssue } from "./describe";

const levelLabels = { error: "Fehler", warn: "Warnung", info: "Info", debug: "Debug" };
const issues: IssueDescriptions = {
  "file.invalid": () => "Die Einstellungsdatei ist ungültig.",
  "schema.invalid": () => "Die Versionsnummer der Einstellungsdatei ist ungültig.",
  "schema.newer": ({ version }) => `Die Einstellungsdatei verwendet Version ${version}.`,
  "migration.failed": ({ version }) =>
    `Einstellungen der Version ${version} konnten nicht migriert werden.`,
  "logLevel.unknown": ({ allowed }) =>
    `Wähle eine verfügbare Protokollstufe (${allowed.map((level) => levelLabels[level]).join(", ")}).`,
};

export const de: ShellCatalog = {
  language: "de",
  issues,
  errors: {
    storage: {
      title: "Einstellungen konnten nicht gelesen oder gespeichert werden",
      detail: "Versuche es erneut.",
    },
    readOnly: {
      title: "Einstellungen sind schreibgeschützt",
      detail: {
        "newer-version": `Die Datei verwendet eine neuere Einstellungsversion. Aktualisiere ${PRODUCT_NAME}, um sie zu bearbeiten.`,
        unreadable:
          "Die Einstellungsdatei ist nicht lesbar. Prüfe die Datei, bevor du Einstellungen bearbeitest.",
      },
    },
    invalidSettings: { title: "Einige Einstellungen sind ungültig" },
    vaultRead: { title: "Der Vault konnte nicht gelesen werden", detail: "Versuche es erneut." },
    clipboard: {
      title: "Die Diagnose konnte nicht kopiert werden",
      detail: "Versuche, sie erneut zu kopieren.",
    },
  },
  defect: {
    title: `Bei ${PRODUCT_NAME} ist ein Problem aufgetreten`,
    detail: (incidentId) =>
      `Melde den Vorfall ${incidentId} in den GitHub Issues von ${PRODUCT_NAME}.`,
  },
  settingsReset: {
    title: "Einige Einstellungen wurden zurückgesetzt",
    detail: (values) => values.map((issue) => describeIssue(issue, issues)).join(" "),
  },
  diagnosticsCopied: {
    title: "Diagnose kopiert",
    detail: "Füge den Bericht in deine Supportanfrage ein.",
  },
  actions: {
    retry: "Erneut versuchen",
    "open-settings": "Einstellungen öffnen",
    "copy-diagnostics": "Diagnose kopieren",
  },
  commands: { openView: `${PRODUCT_NAME} öffnen`, copyDiagnostics: "Diagnose kopieren" },
  frame: {
    navigation: `${PRODUCT_NAME} Navigation`,
    settings: "Einstellungen",
    content: `Inhalt von ${PRODUCT_NAME}`,
    back: "Zurück",
    forward: "Vorwärts",
    settingsSections: "Einstellungsbereiche",
  },
  notFound: {
    title: "Diese Seite ist nicht verfügbar",
    detail: `Öffne die Startseite von ${PRODUCT_NAME}.`,
    back: "Zur Startseite",
  },
  settingsTab: {
    issuesLink: "Probleme auf GitHub melden",
    logLevel: {
      name: "Protokollstufe",
      desc: "Wähle, welche Meldungen im Diagnoseprotokoll erscheinen.",
      labels: levelLabels,
    },
  },
};
