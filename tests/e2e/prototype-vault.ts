import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import { work } from "./backlog-vault";
import { adminFolder, adminProject, customerFolder, customerProject } from "./knowledge-vault";
import { seedStoryMapsVault } from "./story-maps-vault";

export const prototypeChildPath = `${work}/Export mit Testdaten vorbereiten.md`;
export const legacyPrototypeId = "prototype-33333333-3333-4333-8333-000000000283";
export const legacyPrototypeTitle = "CSV-Export in der Fallübersicht";
export const legacyPrototypeLabel = "CSV exportieren";
export const prototypeFolder = `${customerFolder}/Prototypes`;
export const legacyPrototypePath = `${prototypeFolder}/PT-03.md`;
export const prototypeNfrId = "nfr-33333333-3333-4333-8333-000000000287";
export const prototypeNfrTitle = "CSV-Export ohne Daten anderer Organisationen";
export const prototypeNfrPath = `${customerFolder}/CSV-Export ohne Daten anderer Organisationen.md`;

const workItems = [
  [prototypeChildPath, "Task", "TASK-05"],
  [`${work}/Spaltenüberschrift abschneiden.md`, "Issue", "ISS-05"],
  [`${work}/Zeitzone im Export klären.md`, "Frage", "Q-05"],
  [`${work}/Doppelte Fälle im CSV.md`, "Bug", "BUG-05"],
] as const;

export async function seedPrototypesVault() {
  await seedStoryMapsVault();
  const childNotes = workItems.map(([path, type, displayId], index) => ({
    path,
    text: newNoteText(
      {
        schema: "product-engineering.backlog/v1",
        id: `backlog-33333333-3333-4333-8333-00000000029${index}`,
        project_id: customerProject,
        type,
        "pe-id": displayId,
        parent: "[[UC-09]]",
      },
      "Benannte Beispieldaten für den CSV-Export vorbereiten.",
    ),
  }));
  const legacy = {
    schema: "product-engineering.prototype/v1",
    id: legacyPrototypeId,
    display_id: "PT-03",
    project_id: customerProject,
    title: legacyPrototypeTitle,
    uc: "UC-09",
    rev: 2,
    label: legacyPrototypeLabel,
  };
  const notes = [
    ...childNotes,
    { path: legacyPrototypePath, text: newNoteText(legacy, "") },
    {
      path: `${adminFolder}/Admin-Prototyp.md`,
      text: newNoteText(
        {
          ...legacy,
          id: "prototype-33333333-3333-4333-8333-000000000284",
          project_id: adminProject,
          title: "Vertretungszugriff exportieren",
        },
        "",
      ),
    },
    {
      path: prototypeNfrPath,
      text: newNoteText(
        {
          schema: "product-engineering.nfr/v1",
          id: prototypeNfrId,
          project_id: customerProject,
          title: prototypeNfrTitle,
          requirement: "Der Export bleibt auf die eigene Organisation beschränkt.",
          acceptance: "Kein Fall aus einer anderen Organisation ist in der exportierten Datei.",
          categories: [],
          targets: [{ kind: "item", id: "UC-09" }],
        },
        "",
      ),
    },
  ];
  await browser.executeObsidian(
    async ({ app }, folder, entries) => {
      await app.vault.createFolder(folder);
      for (const { path, text } of entries) await app.vault.create(path, text);
    },
    prototypeFolder,
    notes,
  );
}
