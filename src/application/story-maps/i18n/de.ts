import type { en } from "./en";

export const de: typeof en = {
  title: "Story Maps",
  intro: "Nutzerabläufe und Lieferabschnitte planen.",
  empty: "Hier sind noch keine Story Maps angelegt.",
  loading: "Story Maps werden geladen …",
  missing: "Diese Story Map ist in diesem Projekt nicht verfügbar.",
  create: "Story Map erstellen",
  createFromPrd: "Story Map anlegen",
  source: "Quell-PRD",
  sourceLabel: (title, id) => `Aus dem PRD ${title} · ${id}`,
  cancel: "Abbrechen",
  fields: {
    title: "Name der Story Map",
    persona: "Zielgruppe",
    goal: "Nutzerziel",
  },
  invalid: {
    title: "Gib einen Namen mit höchstens 160 Zeichen ein.",
    persona: "Gib eine Zielgruppe mit höchstens 100 Zeichen ein.",
    goal: "Gib ein Nutzerziel mit höchstens 300 Zeichen ein.",
  },
  storyCount: (count) => (count === 1 ? "1 Story" : `${count} Storys`),
  linkedStoryCount: (count) => `${count} mit Backlog-Link`,
  openNote: "Story-Map-Notiz öffnen",
  backToMaps: "Zurück zu Story Maps",
  errors: {
    scope: "Das Projekt ist nicht verfügbar.",
    identity: "Diese Story-Map-ID wird bereits verwendet.",
    fields: "Überprüfe den Namen der Story Map, die Zielgruppe und das Nutzerziel.",
    source: "Das Quell-PRD ist in diesem Projekt nicht verfügbar.",
  },
};
