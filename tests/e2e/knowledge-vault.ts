import { browser } from "@wdio/globals";
import { encodeProjectMembers } from "../../src/domain/projects";
import { newNoteText } from "../../src/domain/notes";

export const customerProject = "project-33333333-3333-4333-8333-000000000001";
export const adminProject = "project-33333333-3333-4333-8333-000000000002";
export const mara = "project-member-33333333-3333-4333-8333-000000000001";
export const customerFolder = "Produkte/Kundenportal";
export const adminFolder = "Produkte/Admin Console";
export const projectFile = `${customerFolder}/Project.md`;
export const customerRequirement = "knowledge-33333333-3333-4333-8333-000000000003";
export const adminRequirement = "knowledge-33333333-3333-4333-8333-000000000004";
export const jobOne = "knowledge-33333333-3333-4333-8333-000000000005";
export const jobTwo = "knowledge-33333333-3333-4333-8333-000000000006";
export const vision = "knowledge-33333333-3333-4333-8333-000000000007";
export const wideTitle =
  "Freigabe für externe Servicepartner mit organisationsübergreifender Stellvertretung und nachvollziehbarer Berechtigung";

const records = [
  [
    customerRequirement,
    "prd",
    "PRD-03",
    wideTitle,
    "## Problem\n\n**Freigaben** mit [[Service|Partnern]] prüfen. <img src=x>",
    {
      requirement_id: "REQ-03",
    },
  ],
  [
    jobOne,
    "jtbd",
    "JOB-12",
    "Weisung für einen Servicefall freigeben",
    "## Situation\n\nDas Serviceteam bearbeitet Anfragen.",
    {},
  ],
  [
    jobTwo,
    "jtbd",
    "JOB-19",
    "Freigabe nachvollziehen",
    "## Situation\n\nPartner wollen Entscheidungen nachvollziehen.",
    {},
  ],
  [
    vision,
    "vision",
    "VIS-01",
    "Durchgängiger Kundenservice",
    "## Vision\n\nAlle Beteiligten sehen denselben Auftrag.",
    {},
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000008",
    "field-guide",
    "GUIDE-01",
    "Archivierte Anleitung",
    "## Leitfaden\n\nBestehender Inhalt.",
    {},
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000009",
    "test-concept",
    "TST-01",
    "Abnahme im Kundenportal",
    "## Qualität\n\nTests erfolgen im Staging.",
    { owner_id: mara },
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000010",
    "actor",
    "AKT-01",
    "Servicekoordinatorin",
    "## Rolle und Ziel\n\nKoordiniert externe Aufträge.",
    { actor_type: "human", owner_id: mara },
  ],
  [
    "knowledge-33333333-3333-4333-8333-000000000011",
    "actor",
    "AKT-02",
    "Identity Broker",
    "## Rolle und Ziel\n\nPrüft Anmeldungen.",
    { actor_type: "system" },
  ],
] as const;

function registration(
  folder: string,
  id: string,
  name: string,
  description: string,
  repository: string,
) {
  const team =
    id === customerProject
      ? encodeProjectMembers([{ id: mara, name: "Mara König", role: "product-owner" }])
      : undefined;
  return {
    path: `${folder}/Project.md`,
    text: newNoteText(
      {
        schema: "product-engineering.project/v1",
        id,
        name,
        description,
        repository,
        branch: "main",
        team,
        backlog_base: "Backlog.base",
      },
      "\nRegistration body.\n",
    ),
  };
}

export async function seedKnowledgeVault() {
  const files = [
    registration(
      customerFolder,
      customerProject,
      "Kundenportal",
      "Serviceprozesse für B2B-Kunden",
      "produktteam/kundenportal",
    ),
    registration(
      adminFolder,
      adminProject,
      "Admin Console",
      "Rollen und Zugriffe verwalten",
      "produktteam/admin-console",
    ),
    ...records.map(([id, kind, display_id, title, body, extra]) => ({
      path: `${customerFolder}/${display_id}.md`,
      text: newNoteText(
        {
          schema: "product-engineering.knowledge/v1",
          id,
          kind,
          title,
          display_id,
          project_id: customerProject,
          approval: "approved",
          ...extra,
        },
        `\n${body}\n`,
      ),
    })),
    {
      path: `${adminFolder}/PRD-03.md`,
      text: newNoteText(
        {
          schema: "product-engineering.knowledge/v1",
          id: adminRequirement,
          kind: "prd",
          title: wideTitle,
          display_id: "PRD-03",
          project_id: adminProject,
          approval: "draft",
          requirement_id: "REQ-03",
        },
        "\n## Problem\n\nVertrauliche Admin-Daten.\n",
      ),
    },
  ];
  await browser.executeObsidian(
    async ({ app }, folders, entries) => {
      for (const folder of folders) await app.vault.createFolder(folder);
      for (const { path, text } of entries) await app.vault.create(path, text);
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    },
    ["Produkte", customerFolder, adminFolder],
    files,
  );
}
