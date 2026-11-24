import { browser } from "@wdio/globals";
import { newNoteText } from "../../src/domain/notes";
import { exportPath, work } from "./backlog-vault";
import { adminFolder, adminProject, customerFolder, customerProject } from "./knowledge-vault";
import { pbiDeclaration } from "./pbi-vault";
import { requestFolder } from "./request-vault";
import { seedReviewRegisterVault } from "./review-register-vault";
import { addTraceSources } from "./trace-vault";

const otherFeature = `${work}/Hilfe in der Fallübersicht.md`;
const openPbi = `${work}/Leere Trefferliste erklären.md`;
export const clarificationId = "feature-request-33333333-3333-4333-8333-000000000025";
export const clarificationTitle = "Exportumfang mit dem Fachteam klären";
export const clarificationPath = `${requestFolder}/FR-025.md`;

export function seedComparisonOverview() {
  return seedReviewRegisterVault(false, {
    options: { requirement: "REQ-18" },
    async beforeRelease(git) {
      await addTraceSources(true);
      await browser.executeObsidian(
        async ({ app }, seed) => {
          await app.vault.create(seed.otherFeature, seed.feature);
          for (const { path, values } of seed.changes) {
            const note = app.vault.getFileByPath(path);
            if (!note) throw new Error(`Missing overview fixture ${path}`);
            await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
              Object.assign(fields, values);
            });
          }
        },
        {
          otherFeature,
          feature: newNoteText({
            project_id: customerProject,
            type: "Feature",
            "pe-id": "FE-02",
            parent: "[[Kundenservice]]",
            order: 250,
          }),
          changes: [
            { path: exportPath, values: { pbi_stage_choice: "In Progress" } },
            {
              path: `${customerFolder}/VIS-01.md`,
              values: { title: "Produktvision Kundenportal" },
            },
            { path: `${work}/Fallübersicht nach Status filtern.md`, values: { Urgency: "P2" } },
            { path: openPbi, values: { Urgency: "P2", parent: "[[Hilfe in der Fallübersicht]]" } },
          ],
        },
      );
      git("add", "--", pbiDeclaration, "PRD-03.md", "JOB-12.md", "RES-02.md", "VIS-01.md");
      git("commit", "--quiet", "-m", "Commit the overview's linked foundations");
    },
  });
}

export async function seedOverviewClarification() {
  await browser.executeObsidian(
    async ({ app }, entries) => {
      for (const { path, text } of entries) await app.vault.create(path, text);
    },
    [
      {
        path: clarificationPath,
        text: newNoteText({
          schema: "product-engineering.feature-request/v1",
          project_id: customerProject,
          id: clarificationId,
          display_id: "FR-025",
          title: clarificationTitle,
          pbi_id: "UC-09",
          revision: 1,
          sequence: 25,
          scope: "Nur die sichtbaren Fälle exportieren.",
          state: "clarification",
        }),
      },
      {
        path: `${adminFolder}/FR-024.md`,
        text: newNoteText({
          schema: "product-engineering.feature-request/v1",
          project_id: adminProject,
          id: "feature-request-33333333-3333-4333-8333-000000002024",
          display_id: "FR-024",
          title: "Nur in der Administration",
          pbi_id: "UC-09",
          revision: 2,
          sequence: 24,
          scope: "Nur Administration.",
          state: "draft",
        }),
      },
    ],
  );
}

export function finishOverviewOpenWork() {
  return browser.executeObsidian(
    async ({ app }, requestPath, pbiPath) => {
      const request = app.vault.getFileByPath(requestPath);
      const pbi = app.vault.getFileByPath(pbiPath);
      if (!request || !pbi) throw new Error("Missing historical-only fixtures");
      await app.fileManager.trashFile(request);
      await app.fileManager.processFrontMatter(pbi, (fields: Record<string, unknown>) => {
        fields.DeliveryState = "Done";
      });
    },
    clarificationPath,
    openPbi,
  );
}
