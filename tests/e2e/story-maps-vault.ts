import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import type { StoryMapCard, StoryMapCardLink } from "../../src/domain/story-maps";
import { seedBacklogVault, work } from "./backlog-vault";
import {
  adminFolder,
  adminProject,
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
  vision,
} from "./knowledge-vault";

export const customerMapId = "story-map-33333333-3333-4333-8333-000000000231";
export const adminMapId = "story-map-33333333-3333-4333-8333-000000000232";
export const matchedMapTitle = "Servicefälle verlässlich übergeben";
export const matchedMapPersona = "Service-Koordinatorin";
export const matchedMapGoal =
  "Eine bereinigte Fallliste in einem Durchgang an die nächste Schicht übergeben.";
export const matchedMapPath = `${customerFolder}/Story Maps/SM-01.md`;
export const matchedPrdPath = `${customerFolder}/PRD-03.md`;
export const matchedPrdTitle = "Servicefälle übergeben";
export const matchedPrdOutcome =
  "Berechtigte Koordinatorinnen können alle für sie sichtbaren gefilterten Servicefälle vollständig weitergeben.";

const activities = [
  { id: "ACT-01", title: "Arbeit vorbereiten" },
  { id: "ACT-02", title: "Übergabe zusammenstellen" },
];
const steps = [
  { id: "STEP-01", activityId: "ACT-01", title: "Fallübersicht öffnen" },
  { id: "STEP-02", activityId: "ACT-01", title: "Offene Fälle filtern" },
  { id: "STEP-03", activityId: "ACT-02", title: "Ergebnisse prüfen" },
  { id: "STEP-04", activityId: "ACT-02", title: "Fallliste weitergeben" },
];
const slices = [
  {
    id: "SL-01",
    title: "Erster nutzbarer Ablauf",
    outcome: "Gefilterte Fälle in einer Datei übergeben.",
  },
  {
    id: "SL-02",
    title: "Orientierung verbessern",
    outcome: "Auch bei einer leeren Liste den nächsten Schritt erkennen.",
  },
];

const cardRows = [
  [
    "CARD-01",
    "STEP-01",
    "SL-01",
    "Meine Fallübersicht sehen",
    "FE-01",
    "Die Koordinatorin sieht nur Fälle ihrer Organisation.",
  ],
  [
    "CARD-02",
    "STEP-02",
    "SL-01",
    "Nur offene Servicefälle anzeigen",
    "UC-14",
    "So kann die nächste Schicht offene Arbeit übernehmen.",
  ],
  [
    "CARD-03",
    "STEP-04",
    "SL-01",
    "Alle passenden Fälle als CSV exportieren",
    "UC-09",
    "Die Liste enthält die sichtbaren Fälle über alle Ergebnisseiten hinweg.",
  ],
  [
    "CARD-04",
    "STEP-03",
    "SL-02",
    "Leere Trefferliste verstehen",
    "UC-12",
    "Aktive Filter prüfen und bei Bedarf zurücksetzen.",
  ],
  [
    "CARD-05",
    "STEP-04",
    undefined,
    "Übergabeliste mit dem Team teilen",
    undefined,
    "Den passenden Übergabekanal im Workshop klären.",
  ],
] as const;

export const matchedMapLinks: readonly StoryMapCardLink[] = cardRows.flatMap(
  ([cardId, , , , recordId]) =>
    recordId ? [{ cardId, kind: "item", projectId: customerProject, recordId }] : [],
);

function customerMap() {
  const cards: readonly StoryMapCard[] = cardRows.map(
    ([id, stepId, sliceId, title, , description]) => ({
      id,
      stepId,
      ...(sliceId && { sliceId }),
      title,
      description,
    }),
  );
  return {
    schema: "product-engineering.story-map/v1",
    id: customerMapId,
    project_id: customerProject,
    display_id: "SM-01",
    title: matchedMapTitle,
    persona: matchedMapPersona,
    goal: matchedMapGoal,
    prd_id: customerRequirement,
    job_ids: [jobOne],
    activities,
    steps,
    slices,
    cards,
    card_links: matchedMapLinks,
  };
}

function adminMap() {
  return {
    schema: "product-engineering.story-map/v1",
    id: adminMapId,
    project_id: adminProject,
    display_id: "SM-01",
    title: "Zugriff einer Vertretung planen",
    persona: "Administratoren",
    goal: "Konten korrekt zuordnen.",
    activities: [],
    steps: [],
    slices: [],
    cards: [],
    card_links: [],
  };
}

export async function seedStoryMapsVault() {
  await seedBacklogVault();
  const backlog = [
    ["UC-09", "Gefilterte Servicefälle exportieren", "Active"],
    ["UC-12", "Leere Trefferliste erklären", "Open"],
    ["UC-14", "Fallübersicht nach Status filtern", "Done"],
  ].map(([id, title, status], index) => ({
    path: `${work}/${id}.md`,
    text: newNoteText(
      {
        schema: "product-engineering.backlog/v1",
        id: `backlog-33333333-3333-4333-8333-00000000024${index}`,
        "pe-id": id,
        project_id: customerProject,
        type: "PBI",
        title,
        DeliveryState: status,
        parent: "[[Servicefälle verwalten]]",
      },
      "",
    ),
  }));
  const foundations = [
    {
      id: jobOne,
      display_id: "JOB-12",
      kind: "jtbd",
      title: "Offene Fälle verlässlich übergeben",
      body: "## Angestrebter Fortschritt\n\nIch möchte genau die relevanten Fälle weitergeben, damit die nächste Schicht direkt weiterarbeiten kann.",
    },
    {
      id: vision,
      display_id: "VIS-01",
      kind: "vision",
      title: "Durchgängiger Kundenservice",
      body: `## Zielgruppe\n\n${matchedMapPersona}`,
    },
    {
      id: customerRequirement,
      display_id: "PRD-03",
      kind: "prd",
      title: matchedPrdTitle,
      vision_id: vision,
      job_ids: [jobOne],
      requirement_id: "REQ-18",
      body: `## REQ-18 · Ergebnis\n\n${matchedPrdOutcome}`,
    },
  ].map(({ body, ...fields }) => ({
    path: `${customerFolder}/${fields.display_id}.md`,
    text: newNoteText(
      {
        schema: "product-engineering.knowledge/v1",
        project_id: customerProject,
        approval: "approved",
        ...fields,
      },
      body,
    ),
  }));
  await browser.executeObsidian(
    async ({ app, plugins }, entries, maps) => {
      for (const { path, text } of entries) {
        const file = app.vault.getFileByPath(path);
        if (file) await app.vault.modify(file, text);
        else await app.vault.create(path, text);
      }
      for (const { folder, frontmatter } of maps) {
        const created = await plugins.noteStoreProbe.api.create({
          folder,
          name: "SM-01",
          frontmatter,
        });
        if (!created.success)
          throw new Error("Could not write fixture Story Map: " + created.error);
      }
    },
    [...backlog, ...foundations],
    [
      { folder: `${customerFolder}/Story Maps`, frontmatter: customerMap() },
      { folder: `${adminFolder}/Story Maps`, frontmatter: adminMap() },
    ],
  );
}
