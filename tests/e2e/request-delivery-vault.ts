import { browser } from "@wdio/globals";
import { Hash } from "effect";
import { newNoteText } from "../../src/domain/notes";
import { encodeProjectReleaseRules } from "../../src/domain/projects";
import type { ProjectCriterion } from "../../src/domain/projects";
import { exportBody, exportPath, featurePath } from "./backlog-vault";
import {
  customerFolder,
  customerProject,
  customerRequirement,
  jobOne,
  projectFile,
} from "./knowledge-vault";
import { pbiDeclaration, pbiResearch, pbiTitle, seedPbiVault } from "./pbi-vault";
import { requestFolder } from "./request-vault";

export const deliveryRequest = "feature-request-33333333-3333-4333-8333-000000000024";
export const deliveryPath = requestFolder + "/FR-024.md";
export const deliveryScope = "Nur gefilterte Servicefälle als CSV bereitstellen.";
export const nfrPath = customerFolder + "/NFR-Export.md";
export const entityPath = customerFolder + "/Organisation.md";
export const nfrBefore = "Kein CSV-Eintrag gehört zu einer anderen Organisation.";
export const nfrAfter = "Jeder CSV-Eintrag enthält eine Mandantenkennung.";
export const entityBefore = "Geschäftskunde mit einer internen Kundennummer.";
export const entityAfter = "Geschäftskunde mit eigener Mandantenkennung.";
export const prdChange = "Eine Zeile pro gefiltertem Servicefall.";
export const deliveryCriterion = {
  id: "AC-09",
  text: "Nur gefilterte Servicefälle erscheinen im CSV.",
  scenario_id: "SC-09",
  scenario_name: "Gefilterte Fälle exportieren",
  given: "Die Fallliste ist geöffnet.",
  when: "Der Export startet.",
  then_step: "Nur passende Servicefälle sind enthalten.",
};
export const manualReady = "project-criterion-33333333-3333-4333-8333-000000000091";

export async function seedRequestDeliveryVault(
  confirmed: boolean,
  withScope = true,
  options: {
    criteria?: readonly (typeof deliveryCriterion)[];
    ready?: readonly ProjectCriterion[];
    done?: readonly ProjectCriterion[];
    scope?: string;
    rulesVersion?: number;
    requirement?: string;
  } = {},
) {
  const requirement = options.requirement ?? "REQ-03";
  const { git } = await seedPbiVault(requirement);
  const sources = {
    pbi_prd_id: customerRequirement,
    pbi_requirement_id: requirement,
    pbi_job_id: jobOne,
    pbi_research_id: pbiResearch,
    pbi_adr_id: "",
  };
  const criteria = options.criteria ?? [deliveryCriterion];
  const fingerprint = Hash.string(
    JSON.stringify([pbiTitle, exportBody, sources, criteria.map(Object.values), undefined, false]),
  );
  const rulesVersion = options.rulesVersion ?? 2;
  const rules = encodeProjectReleaseRules({
    version: rulesVersion,
    ready: options.ready ?? [
      { id: manualReady, title: "Exportumfang geprüft", type: "manual", enabled: true },
    ],
    done: options.done ?? [],
  });
  await browser.executeObsidian(
    async ({ app }, input) => {
      const pbi = app.vault.getFileByPath(input.exportPath);
      const project = app.vault.getFileByPath(input.projectFile);
      const organisation = app.vault.getFileByPath(input.entityPath);
      if (!pbi || !project || !organisation) throw new Error("Missing seed source notes");
      await app.fileManager.processFrontMatter(pbi, (fields: Record<string, unknown>) => {
        fields.pbi_criteria = input.criteria;
        fields.pbi_approved_revision = 1;
        fields.pbi_approval_fingerprint = input.fingerprint;
      });
      await app.fileManager.processFrontMatter(project, (fields: Record<string, unknown>) => {
        fields.release_rules = input.rules;
      });
      await app.vault.process(organisation, (text) =>
        text.replace("## Geschäftskunde", input.entityBefore),
      );
      if (!input.withScope)
        await app.fileManager.processFrontMatter(
          organisation,
          (fields: Record<string, unknown>) => {
            delete fields.domain_scope;
          },
        );
      await app.vault.createFolder(input.requestFolder);
      await app.vault.create(input.deliveryPath, input.draft);
      if (input.withScope) await app.vault.create(input.nfrPath, input.nfr);
    },
    {
      exportPath,
      projectFile,
      entityPath,
      entityBefore,
      requestFolder,
      deliveryPath,
      nfrPath,
      withScope,
      fingerprint,
      rules,
      criteria,
      draft: newNoteText({
        schema: "product-engineering.feature-request/v1",
        id: deliveryRequest,
        project_id: customerProject,
        display_id: "FR-024",
        title: "CSV-Export · Servicefälle",
        pbi_id: "UC-09",
        sequence: 24,
        revision: 2,
        scope: options.scope ?? deliveryScope,
        state: "draft",
        ...(confirmed && { ready_checks: [manualReady], ready_check_version: rulesVersion }),
      }),
      nfr: newNoteText({
        schema: "product-engineering.nfr/v1",
        id: "nfr-33333333-3333-4333-8333-000000000091",
        project_id: customerProject,
        title: "Mandantenbezug",
        requirement: "Der Export bleibt auf die eigene Organisation beschränkt.",
        acceptance: nfrBefore,
        categories: ["security"],
        targets: [{ kind: "item", id: "FE-01" }],
      }),
    },
  );
  git("add", "--", pbiDeclaration, featurePath.slice(customerFolder.length + 1));
  git("commit", "--quiet", "-m", "Approved UC-09 baseline");
  return { git, baseline: git("rev-parse", "HEAD") };
}

export function changeFixtureFile(path: string, before: string, after: string) {
  return browser.executeObsidian(
    async ({ app }, notePath, previous, updated) => {
      const file = app.vault.getFileByPath(notePath);
      if (!file) throw new Error("Missing note to change in installed fixture");
      await app.vault.process(file, (text) =>
        previous ? text.replace(previous, updated) : text + "\n" + updated + "\n",
      );
    },
    path,
    before,
    after,
  );
}
