import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { projectOverviewRoute } from "../../../src/application/projects";
import {
  adminFolder,
  adminProject,
  adminRequirement,
  seedKnowledgeVault,
} from "../knowledge-vault";
import { openView, readViewRoute, ROOT, setViewRoute } from "../support";

it("offers the exact PRD for repair when a legacy note has no requirement", async () => {
  await seedKnowledgeVault();
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Missing repair fixture");
    await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
      delete fields.requirement_id;
    });
  }, `${adminFolder}/PRD-03.md`);
  await openView();
  await setViewRoute(projectOverviewRoute(adminProject));
  const row = browser.$(`${ROOT} [data-overview-step="prd"]`);
  const repair = row.$("button=Anforderung prüfen");
  await expect(repair).toBeDisplayed();
  await expect(row).toHaveAttribute("aria-current", "step");
  await expect(row.$("[data-complete]")).toHaveAttribute("data-complete", "false");
  await repair.click();
  await expect(browser.$(`${ROOT} [data-testid="knowledge-note"] h1`)).toBeDisplayed();
  expect(await readViewRoute()).toEqual(
    knowledgeDetailRoute(adminProject, adminRequirement, { section: "overview" }),
  );
  await browser.$(`${ROOT} [data-testid="project-record-return"]`).click();
  await expect(repair).toBeFocused();
});
