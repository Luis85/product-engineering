import type { NotesCatalog } from "./catalog";

export const de: NotesCatalog = {
  errors: {
    NoteNotFoundError: {
      title: "Notiz nicht verfügbar",
      detail: "Wähle eine vorhandene Markdown-Notiz.",
    },
    NotePathTakenError: {
      title: "Name bereits vergeben",
      detail: "Wähle einen anderen Namen für die Notiz.",
    },
    NoteUnreadableError: {
      title: "Frontmatter ist nicht lesbar",
      detail: "Öffne die Notiz und korrigiere ihre Frontmatter.",
    },
    NoteWriteError: {
      title: "Die Notiz konnte nicht gespeichert werden",
      detail: "Versuche erneut, die Notiz zu speichern.",
    },
    NoteTrashError: {
      title: "Die Notiz konnte nicht gelöscht werden",
      detail: "Versuche erneut, die Notiz zu löschen.",
    },
    NoteEditConflictError: {
      title: "Änderungen stehen im Konflikt",
      detail: "Prüfe die Felder, die während der Bearbeitung im Vault geändert wurden.",
    },
    NoteIndexReadError: {
      title: "Datensätze konnten nicht gelesen werden",
      detail: "Baue den Notizindex neu auf, um es erneut zu versuchen.",
    },
  },
  issues: {
    fields: {
      "field.text": (label) => `${label} muss Text sein.`,
      "field.number": (label) => `Gib für ${label} eine endliche Zahl ein.`,
      "field.checkbox": (label) => `Wähle für ${label} wahr oder falsch.`,
      "field.date": (label) => `Gib für ${label} ein gültiges Datum im Format JJJJ-MM-TT ein.`,
      "field.list": (label) => `${label} muss eine Liste mit Textwerten sein.`,
      "field.missing": (label) => `Gib einen Wert für ${label} ein.`,
    },
    customField: (label) => `Prüfe den Wert für ${label}.`,
    identity: {
      "id.missing": "Die Datensatz-ID fehlt.",
      "id.malformed": "Das Format der Datensatz-ID ist ungültig.",
      "id.other-type": "Die Datensatz-ID gehört zu einem anderen Datensatztyp.",
    },
    duplicateId: (other) => `Eine andere Notiz verwendet diese Datensatz-ID (${other}).`,
    newerSchema: (version) =>
      `Diese Notiz verwendet ein neueres Datensatzschema (Version ${version}).`,
    failedMigration: (version) =>
      `Der Datensatz konnte nicht von Version ${version} migriert werden.`,
  },
  unindexed: {
    malformedSchema: "Das Datensatzschema hat ein ungültiges Format.",
    unknownType: (type) => `Der Datensatztyp ${type} ist nicht registriert.`,
    unreadableFrontmatter: "Öffne die Notiz und korrigiere ihre Frontmatter.",
  },
  invalidName: {
    title: "Ungültiger Notizname",
    details: {
      empty: "Gib einen Namen für die Notiz ein.",
      "forbidden-character": "Entferne die nicht unterstützten Zeichen aus dem Notiznamen.",
      "leading-dot": "Beginne den Notiznamen mit einem anderen Zeichen als einem Punkt.",
    },
  },
  writeRefused: {
    title: "Die Notiz lässt sich nicht sicher bearbeiten",
    details: {
      "other-type": "Wähle eine Notiz mit diesem Datensatztyp.",
      "newer-version":
        "Aktualisiere das Plugin Product Engineering, bevor du die Notiz bearbeitest.",
      identity: "Öffne die Notiz und prüfe ID und Schema des Datensatzes.",
      "duplicate-id": "Gib jedem Datensatz eine eindeutige ID.",
      "migration-failed":
        "Öffne die Notiz und korrigiere ihre Eigenschaften, bevor du sie bearbeitest.",
      layout: "Öffne die Notiz und schreibe jede Frontmatter-Eigenschaft in eine eigene Zeile.",
    },
  },
};
