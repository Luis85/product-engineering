import { browser } from "@wdio/globals";
import { Hash } from "effect";
import { newNoteText, splitNoteText } from "../../src/domain/notes";
import { work } from "./backlog-vault";
import { customerFolder, customerProject, customerRequirement, jobOne } from "./knowledge-vault";
import { pbiResearch, seedPbiVault } from "./pbi-vault";

export const readyPbiId = "UC-14";
export const readyPbiTitle = "Exportfilter bestätigen";
export const requestFolder = customerFolder + "/Feature Requests";

export async function seedRequestsVault() {
  const { git } = await seedPbiVault();
  const title = readyPbiTitle;
  const body = "Der Export enthält die bestätigte Filterauswahl.\n";
  const sources = {
    pbi_prd_id: customerRequirement,
    pbi_requirement_id: "REQ-03",
    pbi_job_id: jobOne,
    pbi_research_id: pbiResearch,
    pbi_adr_id: "",
  };
  const criterion = {
    id: "AC-14",
    text: "Die gewählten Filter bestimmen den Export.",
    scenario_id: "SC-14",
    scenario_name: "Filtern und exportieren",
    given: "Die Fallübersicht ist geöffnet.",
    when: "Der Filter wird angewendet.",
    then_step: "Die CSV enthält nur passende Fälle.",
  };
  const fingerprint = Hash.string(
    JSON.stringify([
      title,
      splitNoteText(newNoteText({}, body)).body,
      sources,
      [Object.values(criterion)],
      undefined,
      false,
    ]),
  );
  const path = work + "/Exportfilter bestätigen.md";
  await browser.executeObsidian(
    async ({ app }, folder, entries) => {
      await app.vault.createFolder(folder);
      for (const entry of entries) await app.vault.create(entry.path, entry.text);
    },
    requestFolder,
    [
      {
        path,
        text: newNoteText(
          {
            schema: "product-engineering.backlog/v1",
            id: "backlog-33333333-3333-4333-8333-000000000014",
            project_id: customerProject,
            "pe-id": readyPbiId,
            title,
            type: "PBI",
            parent: "[[Servicefälle verwalten]]",
            DeliveryState: "Open",
            ...sources,
            pbi_criteria: [criterion],
            pbi_approved_revision: 1,
            pbi_approval_fingerprint: fingerprint,
          },
          body,
        ),
      },
      {
        path: requestFolder + "/FR-024.md",
        text: newNoteText(
          {
            schema: "product-engineering.feature-request/v1",
            id: "feature-request-33333333-3333-4333-8333-000000000024",
            project_id: customerProject,
            display_id: "FR-024",
            title: "CSV-Export · Servicefälle",
            pbi_id: "UC-09",
            scope: "Gefilterte Servicefälle im CSV bereitstellen.",
            state: "review",
            sequence: 24,
            revision: 2,
            run_id: "RUN-042",
            done_gates: [
              { id: "base-done", status: "passed" },
              { id: "base-review", status: "open" },
              {
                id: "project-criterion-33333333-3333-4333-8333-000000000043",
                title: "Keine offenen Bugs",
                status: "passed",
              },
            ],
          },
          "",
        ),
      },
    ],
  );
  git("add", "--", path.substring(customerFolder.length + 1));
  git("commit", "--quiet", "-m", "Eligible request fixture");
}
