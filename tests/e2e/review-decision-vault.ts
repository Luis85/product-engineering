import { browser } from "@wdio/globals";
import { parse } from "yaml";
import type { FeatureRequestRevision } from "../../src/application/feature-requests";
import { frontmatterYaml, newNoteText, splitNoteText } from "../../src/domain/notes";
import { encodeProjectMembers } from "../../src/domain/projects";
import type { ProjectCriterion } from "../../src/domain/projects";
import { work } from "./backlog-vault";
import { customerProject, projectFile } from "./knowledge-vault";
import { pbiTitle } from "./pbi-vault";
import { deliveryPath } from "./request-delivery-vault";
import { seedReviewRegisterVault } from "./review-register-vault";
import { readVaultText } from "./support";

const rule = (index: number, title: string, type: ProjectCriterion["type"]): ProjectCriterion => ({
  id: `project-criterion-33333333-3333-4333-8333-0000000001${String(index).padStart(2, "0")}`,
  title,
  type,
  enabled: true,
});

export const scopeRules = {
  manual: rule(21, "Export in der Fachansicht geprüft", "manual"),
  scope: rule(22, "Lieferumfang beschrieben", "scope"),
  tasks: rule(23, "Tasks erledigt", "open-task"),
  issues: rule(24, "Issues geklärt", "open-issue"),
  bugs: rule(25, "Bugs geklärt", "open-bug"),
  work: rule(26, "Begleititems erledigt", "open-work"),
};
export const releasedBug = {
  id: "BUG-93",
  title: "CSV-Zeilentrenner",
  type: "Bug",
  status: "Done",
};
export const releasedIssue = {
  id: "ISS-94",
  title: "Dateiname dokumentieren",
  type: "Issue",
  status: "Done",
};
export const currentTask = {
  id: "TASK-95",
  title: "Exporttext prüfen",
  type: "Task",
  status: "Open",
};
export const unrelatedTask = {
  id: "TASK-96",
  title: "Anderen Dialog prüfen",
  type: "Task",
  status: "Open",
};

export async function addReviewWork(item: typeof releasedBug, parent: string = pbiTitle) {
  await browser.executeObsidian(
    async ({ app }, path, text) => {
      await app.vault.create(path, text);
    },
    work + "/" + item.id + ".md",
    newNoteText({
      project_id: customerProject,
      "pe-id": item.id,
      type: item.type,
      title: item.title,
      parent: "[[" + parent + "]]",
      DeliveryState: item.status,
    }),
  );
}

export async function removeReviewWork(id: string) {
  await browser.executeObsidian(
    async ({ app }, path) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing work fixture");
      await app.vault.delete(file);
    },
    work + "/" + id + ".md",
  );
}

export async function setReviewWorkDone(id: string) {
  await browser.executeObsidian(
    async ({ app }, path) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing work fixture");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.DeliveryState = "Done";
      });
    },
    work + "/" + id + ".md",
  );
}

async function addProductOwner() {
  const team = encodeProjectMembers([
    {
      id: "project-member-33333333-3333-4333-8333-000000000102",
      role: "product-owner",
      name: "Mara König",
    },
  ]);
  await browser.executeObsidian(
    async ({ app }, path, members) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing project");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.team = members;
      });
    },
    projectFile,
    team,
  );
}

export function seedRichReviewDecision() {
  return seedReviewRegisterVault(false, {
    options: { done: Object.values(scopeRules) },
    async beforeRelease() {
      await addProductOwner();
      await addReviewWork(releasedBug);
      await addReviewWork(releasedIssue);
      await addReviewWork(unrelatedTask, "Freigabe dokumentieren");
    },
  });
}

const comparisonCriteria = [
  {
    id: "AC-01",
    text: "Alle sichtbaren Treffer exportieren",
    scenario_id: "SC-091",
    scenario_name: "Alle sichtbaren Treffer exportieren",
    given: "eine berechtigte Koordinatorin 27 gefilterte Fälle sieht",
    when: "sie die Treffer als CSV exportiert",
    then_step: "die CSV alle 27 gefilterten Fälle enthält",
  },
  {
    id: "AC-02",
    text: "Organisationsgrenze einhalten",
    scenario_id: "SC-092",
    scenario_name: "Organisationsgrenze einhalten",
    given: "passende Fälle in zwei Organisationen vorliegen",
    when: "die Koordinatorin die Treffer exportiert",
    then_step: "die CSV nur Fälle ihrer Organisation enthält",
  },
];

export function seedComparisonReviewDecision() {
  return seedReviewRegisterVault(false, {
    withScope: false,
    options: {
      criteria: comparisonCriteria,
      scope: "Gesamter Use-Case",
      rulesVersion: 1,
      ready: [rule(32, "Umfang ist beschrieben", "scope")],
      done: [rule(31, "Offene Bugs sind geklärt", "open-bug")],
    },
    beforeRelease: addProductOwner,
    mapRelease: ({ nfrs: _nfrs, domain: _domain, ...payload }) => payload,
  });
}

export async function readReviewFixture() {
  const bytes = await readVaultText(deliveryPath);
  const yaml = bytes && frontmatterYaml(splitNoteText(bytes));
  if (!bytes || !yaml) throw new Error("Missing request frontmatter fixture");
  const fields = parse(yaml) as { delivery_data: string; state: string };
  const delivery = JSON.parse(fields.delivery_data) as {
    current: Pick<FeatureRequestRevision, "decision" | "events" | "exportJson" | "run">;
    history: readonly FeatureRequestRevision[];
  };
  return { bytes, delivery, state: fields.state, value: fields.delivery_data };
}
