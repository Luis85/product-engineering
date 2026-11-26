import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { catalogFor } from "../../../src/application/messages";
import { projectOverviewRoute } from "../../../src/application/projects";
import {
  createProviderFixture,
  finishProviderCall,
  readProviderCalls,
} from "../ai-provider-fixture";
import { seedKnowledgeDetailVault } from "../knowledge-detail-vault";
import { customerProject, customerRequirement } from "../knowledge-vault";
import {
  openView,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  TEST_LANGUAGE,
  writeDataFile,
} from "../support";

it("focuses the mounted note when a Copilot citation revisits it and hands Back to the origin", async () => {
  await seedKnowledgeDetailVault();
  const provider = await createProviderFixture();
  await writeDataFile({
    schemaVersion: 1,
    aiEnabled: true,
    aiMode: "codex",
    codexPath: provider.codexPath,
  });
  await reloadPlugin();
  await openView();
  const note = knowledgeDetailRoute(customerProject, customerRequirement);
  const overview = projectOverviewRoute(customerProject);
  await setViewRoute(note);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const text = catalogFor(TEST_LANGUAGE);
  const heading = browser.$(`${ROOT} [data-testid=knowledge-note-header] h1`);
  const overviewRail = browser.$(
    `${ROOT} [data-testid=project-rail] [data-pe-focus-key=project-overview]`,
  );
  const copilot = browser.$(`${ROOT} button[aria-label="${text.projects.copilot}"]`);
  const panel = browser.$(`${ROOT} [data-testid=copilot-workspace]`);
  await expect(heading).toHaveText("Servicefälle übergeben");
  await overviewRail.click();
  expect(await readViewRoute()).toEqual(overview);
  await copilot.click();

  const key = "knowledge:" + customerRequirement;
  await panel.$("[data-testid=copilot-choose-sources]").click();
  await panel.$(`input[data-testid=copilot-source][value="${key}"]`).click();
  expect(await readProviderCalls()).toHaveLength(0);
  const prompt = "Nenne die gewählte Übergabequelle.";
  await panel.$("[data-testid=copilot-prompt]").setValue(prompt);
  await panel.$("button[type=submit]").click();
  await browser.waitUntil(
    async () => (await readProviderCalls())[0]?.input.includes(prompt) === true,
  );
  await finishProviderCall(0, "Die gewählte Quelle ist PRD-03.");
  const citation = panel.$(`[data-testid=copilot-source-link][data-source-key="${key}"]`);
  await expect(citation).toHaveText("PRD-03 · Servicefälle übergeben");
  await citation.click();
  await expect(panel).not.toExist();
  expect(await readViewRoute()).toEqual(note);
  await expect(heading).toHaveText("Servicefälle übergeben");
  await expect(heading).toBeFocused();

  await browser.$(`${ROOT} button[aria-label="${text.shell.frame.back}"]`).click();
  expect(await readViewRoute()).toEqual(overview);
  await expect(copilot).toBeFocused();
  expect(await readProviderCalls()).toHaveLength(1);
});
