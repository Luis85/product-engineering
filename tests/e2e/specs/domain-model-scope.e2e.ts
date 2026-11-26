import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { domainModelRoute } from "../../../src/application/domain-model";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { catalogFor } from "../../../src/application/messages";
import { organisation, organisationPath, seedDomainModelVault } from "../domain-model-vault";
import { adminProject, customerProject, customerRequirement } from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
} from "../support";

const element = (id: string) => browser.$(`${ROOT} [data-testid=${id}]`);
const assignment = () => element("domain-scope");
const dialog = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);
const from = (selection: string) => setViewRoute(domainModelRoute(customerProject, selection));
const approval = catalogFor(TEST_LANGUAGE).knowledge.approvals;

before(() => seedDomainModelVault());

it("writes and removes the PRD assignment from both ends of the same installed Knowledge record", async () => {
  await openView();
  await setViewRoute(knowledgeDetailRoute(customerProject, customerRequirement));
  await expect(assignment()).toBeDisplayed();
  expect(await readVaultText(organisationPath)).toContain("approval: approved");
  await assignment()
    .$("select[name=domain-assignment]")
    .selectByVisibleText("Organisation · ENT-01");
  await assignment().$("button[type=submit]").click();
  const linked = assignment().$(`[data-domain-scope-link="${organisation}"]`);
  await expect(linked).toBeDisplayed();
  const changed = await readVaultText(organisationPath);
  expect(changed).toContain(customerRequirement);
  expect(changed).toContain("approval: draft");
  await linked.click();
  await expect(element("knowledge-note-header").$("h1")).toHaveText("Organisation");
  await expect(element("knowledge-note-header").$(".pe-note-meta")).toHaveText(
    expect.stringContaining(approval.draft),
  );
  await expect(assignment().$(`[data-domain-scope-link="${customerRequirement}"]`)).toBeDisplayed();
  await assignment().$("button[data-domain-remove-assignment]").click();
  await expect(assignment().$(`[data-domain-scope-link="${customerRequirement}"]`)).not.toExist();
  expect(await readVaultText(organisationPath)).not.toContain(customerRequirement);
  await element("project-record-return").click();
  await expect(assignment()).toBeDisplayed();
  await expect(linked).not.toExist();
});

it("archives from the model, keeps live links and REL identity, and restores the same note in Knowledge", async () => {
  await from(organisation);
  await expect(element("domain-inspector").$("h2")).toHaveText("Organisation");
  await element("domain-archive-entity").click();
  await expect(dialog()).toBeDisplayed();
  await element("domain-confirm").click();
  await expect(browser.$(`${ROOT} [data-domain-node="${organisation}"]`)).not.toExist();
  expect(await readVaultText(organisationPath)).toContain("domain_archived: true");
  expect(await readVaultText(organisationPath)).toContain("REL-01");
  await from(organisation);
  await element("domain-knowledge-note").click();
  await expect(element("knowledge-note-header").$("h1")).toHaveText("Organisation");
  await expect(element("domain-restore-entity")).toBeDisplayed();
  await element("domain-restore-entity").click();
  await expect(element("domain-restore-entity")).not.toExist();
  expect(await readVaultText(organisationPath)).toContain("REL-01");
  await element("domain-model-link").click();
  await expect(browser.$(`${ROOT} [data-domain-node="${organisation}"]`)).toBeDisplayed();
  await from("REL-01");
  await expect(element("domain-inspector").$("h2")).toHaveText("meldet");
  await setViewRoute(domainModelRoute(adminProject, "REL-01"));
  await expect(element("domain-inspector").$("h2")).toHaveText("verwaltet");
  expect(await readViewRoute()).toEqual(domainModelRoute(adminProject, "REL-01"));
});
