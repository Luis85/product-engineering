import { browser } from "@wdio/globals";
import { backlogBaseText } from "../../src/application/projects";
import { newNoteText } from "../../src/domain/notes";
import {
  adminFolder,
  adminProject,
  adminRequirement,
  customerFolder,
  customerProject,
  jobOne,
  seedKnowledgeVault,
} from "./knowledge-vault";
import { customerMap, matchedMapPath, seedStoryMapsVault } from "./story-maps-vault";

export async function seedBlankOverviewVault() {
  await seedKnowledgeVault();
  await browser.executeObsidian(
    async ({ app }, folder, base) => {
      const file = app.vault.getFileByPath(`${folder}/PRD-03.md`);
      if (!file) throw new Error("Missing seeded PRD in the blank project's folder");
      await app.fileManager.trashFile(file);
      await app.vault.create(`${folder}/Backlog.base`, base);
    },
    adminFolder,
    backlogBaseText(adminProject),
  );
}

export const alternateMapId = "story-map-33333333-3333-4333-8333-000000000233";
export const alternateMapTitle = "Falllisten über einen geteilten Link übergeben";
export const alternateSlice = "Erste Freigabe per Link";
export const alternatePrd = "Übergabe als Lesefreigabe";
export const alternateVision = "Gemeinsame Sicht auf Servicefälle";
const alternatePrdId = "knowledge-33333333-3333-4333-8333-000000000251";
const alternateVisionId = "knowledge-33333333-3333-4333-8333-000000000252";
const adminVisionId = "knowledge-33333333-3333-4333-8333-000000000253";
const adminJobId = "knowledge-33333333-3333-4333-8333-000000000254";
const alternatePath = `${customerFolder}/Story Maps/SM-02.md`;

function overviewNote(
  projectId: string,
  id: string,
  kind: string,
  displayId: string,
  title: string,
  relations = {},
) {
  return newNoteText(
    {
      schema: "product-engineering.knowledge/v1",
      project_id: projectId,
      id,
      kind,
      display_id: displayId,
      title,
      approval: "approved",
      ...relations,
    },
    "\n## Zielgruppe\n\nKoordination im Kundendienst.\n",
  );
}

export async function seedOverviewContexts() {
  await seedStoryMapsVault();
  const map = customerMap();
  const adminVision = "Vertretung in der Administration absichern";
  const adminJob = "Vertretung berechtigen";
  const alternate = {
    ...map,
    id: alternateMapId,
    display_id: "SM-02",
    title: alternateMapTitle,
    prd_id: alternatePrdId,
    slices: [
      { id: "SL-01", title: alternateSlice, outcome: "Eine freigegebene Liste bleibt lesbar." },
    ],
    cards: [],
    card_links: [],
  };
  const admin = {
    ...map,
    id: "story-map-33333333-3333-4333-8333-000000000232",
    project_id: adminProject,
    title: "Zugriff einer Vertretung planen",
    prd_id: adminRequirement,
    job_ids: [adminJobId],
    slices: [{ id: "SL-01", title: "Erste Stellvertretung", outcome: "Die Übergabe ist möglich." }],
    cards: [
      {
        id: "CARD-01",
        stepId: "STEP-01",
        sliceId: "SL-01",
        title: "Vertretung einsetzen",
        description: "Eine Vertretung hat Zugriff.",
      },
    ],
    card_links: [{ projectId: adminProject, kind: "item", cardId: "CARD-01", recordId: "UC-09" }],
  };
  await browser.executeObsidian(
    async ({ app }, seed) => {
      for (const { path, text } of seed.notes) {
        const file = app.vault.getFileByPath(path);
        if (file) await app.vault.modify(file, text);
        else await app.vault.create(path, text);
      }
      const original = app.vault.getFileByPath(seed.original);
      if (!original) throw new Error("Missing map to add invalid associations");
      await app.fileManager.processFrontMatter(original, (fields: Record<string, unknown>) => {
        fields.card_links = [...seed.valid, ...seed.invalid];
      });
    },
    {
      notes: [
        {
          path: `${customerFolder}/PRD-04.md`,
          text: overviewNote(customerProject, alternatePrdId, "prd", "PRD-04", alternatePrd, {
            job_ids: [jobOne],
            vision_id: alternateVisionId,
            requirement_id: "REQ-19",
          }),
        },
        {
          path: `${customerFolder}/VIS-02.md`,
          text: overviewNote(
            customerProject,
            alternateVisionId,
            "vision",
            "VIS-02",
            alternateVision,
          ),
        },
        {
          path: `${adminFolder}/JOB-12.md`,
          text: overviewNote(adminProject, adminJobId, "jtbd", "JOB-12", adminJob),
        },
        {
          path: `${adminFolder}/VIS-01.md`,
          text: overviewNote(adminProject, adminVisionId, "vision", "VIS-01", adminVision),
        },
        {
          path: `${adminFolder}/PRD-03.md`,
          text: overviewNote(
            adminProject,
            adminRequirement,
            "prd",
            "PRD-03",
            "Berechtigungen für Stellvertretung",
            { job_ids: [adminJobId], vision_id: adminVisionId, requirement_id: "REQ-18" },
          ),
        },
        {
          path: `${adminFolder}/Admin service.md`,
          text: newNoteText({
            schema: "product-engineering.backlog/v1",
            project_id: adminProject,
            "pe-id": "UC-09",
            id: "backlog-33333333-3333-4333-8333-000000000255",
            type: "PBI",
            title: "Administrativen Zugriff übergeben",
          }),
        },
        { path: `${adminFolder}/Story Maps/SM-01.md`, text: newNoteText(admin) },
        { path: alternatePath, text: newNoteText(alternate) },
      ],
      original: matchedMapPath,
      valid: map.card_links,
      invalid: [
        { projectId: adminProject, kind: "item", cardId: "CARD-01", recordId: "UC-09" },
        { projectId: customerProject, kind: "item", cardId: "CARD-01", recordId: "UC-99" },
      ],
    },
  );
}

export async function populateAlternateSlice() {
  await browser.executeObsidian(
    async ({ app }, path, projectId) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing alternate map");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.cards = [
          {
            id: "CARD-01",
            stepId: "STEP-01",
            sliceId: "SL-01",
            title: "Link prüfen",
            description: "Der Link funktioniert.",
          },
          {
            id: "CARD-02",
            stepId: "STEP-01",
            sliceId: "SL-01",
            title: "Link mehrfach öffnen",
            description: "Die Liste bleibt lesbar.",
          },
        ];
        fields.card_links = [{ projectId, kind: "item", cardId: "CARD-01", recordId: "UC-12" }];
      });
    },
    alternatePath,
    customerProject,
  );
}
