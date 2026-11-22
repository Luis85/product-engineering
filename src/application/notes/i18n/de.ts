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
