import { TITLE_MAX_LENGTH } from "../../../domain/items";
import { MAX_FILE_NAME_BYTES } from "../../../domain/notes";
import type { ItemsCatalog } from "./catalog";

export const de = {
  settings: {
    label: "Einträge",
    empty: "Noch keine Einträge.",
    loading: "Einträge werden geladen …",
    folder: (path) => `Einträge werden in ${path} gespeichert.`,
  },
  fields: { title: "Titel", status: "Status", due: "Fällig am" },
  missing: { title: "Gib einen Titel ein.", status: "Wähle einen Status." },
  issues: {
    "title.invalid": () =>
      `Gib eine Zeile mit höchstens ${TITLE_MAX_LENGTH} Zeichen ohne Steuerzeichen ein.`,
    "title.too-long": () =>
      `Kürze den Titel, damit der Dateiname höchstens ${MAX_FILE_NAME_BYTES} Bytes lang ist.`,
    "title.taken": () => "Wähle einen Titel, den kein anderer Eintrag verwendet.",
    "title.duplicate": () => "Ein anderer Eintrag hat diesen Titel.",
    "status.unknown": () => "Wähle Offen oder Erledigt.",
  },
  status: { open: "Offen", done: "Erledigt" },
  form: {
    createTitle: "Eintrag hinzufügen",
    editTitle: "Eintrag bearbeiten",
    summary: {
      title: "Überprüfe die Angaben",
      detail: "Korrigiere die markierten Felder und speichere erneut.",
    },
  },
  actions: {
    add: "Eintrag hinzufügen",
    edit: "Bearbeiten",
    remove: "Löschen",
    cancel: "Abbrechen",
    save: "Speichern",
  },
} satisfies ItemsCatalog;
