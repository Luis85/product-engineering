import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import {
  createProviderFixture,
  finishProviderCall,
  readProviderCalls,
} from "../ai-provider-fixture";
import { customerProject, customerRequirement, seedKnowledgeVault } from "../knowledge-vault";
import {
  openView,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
  writeDataFile,
} from "../support";

function requestContent(input: string | undefined): unknown {
  const line = input?.split("\n").at(1);
  if (!line) throw new Error("Missing Codex conversation JSON");
  const messages = JSON.parse(line) as readonly { content: string }[];
  const latest = messages.at(-1);
  if (!latest) throw new Error("Missing the explicit review request");
  return JSON.parse(latest.content) as unknown;
}

it("requires an exact selected project target before sending a native Review", async () => {
  await seedKnowledgeVault();
  const provider = await createProviderFixture();
  await writeDataFile({
    schemaVersion: 1,
    aiEnabled: true,
    aiMode: "codex",
    codexPath: provider.codexPath,
  });
  await reloadPlugin();
  await openView();
  const overview = projectOverviewRoute(customerProject);
  await setViewRoute(overview);
  await browser.$(`${ROOT} button[aria-label="KI-Copilot"]`).click();
  const panel = browser.$(`${ROOT} [data-testid=copilot-workspace]`);
  const mode = panel.$("[data-testid=copilot-mode]");
  const target = panel.$("[data-testid=copilot-review-target]");
  const send = panel.$("button[type=submit]");
  const prompt = "Prüfe die Übergaberegeln.";
  await mode.selectByAttribute("value", "review");
  await panel.$("[data-testid=copilot-prompt]").setValue(prompt);
  expect(await panel.$$("input[data-testid=copilot-source]:checked")).toHaveLength(0);
  await expect(target).toHaveValue("");
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await send.click();
  expect(await readProviderCalls()).toHaveLength(0);

  const key = "knowledge:" + customerRequirement;
  await target.selectByAttribute("value", key);
  await expect(send).toHaveAttribute("aria-disabled", "false");
  await panel.$("[data-testid=copilot-choose-sources]").click();
  const source = panel.$(`input[data-testid=copilot-source][value="${key}"]`);
  await expect(source).toBeSelected();
  await source.click();
  await expect(target).toHaveValue("");
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await source.click();
  await expect(send).toHaveAttribute("aria-disabled", "true");
  expect(await readProviderCalls()).toHaveLength(0);

  await target.selectByAttribute("value", key);
  await send.click();
  await browser.waitUntil(
    async () => (await readProviderCalls())[0]?.input.includes(prompt) === true,
  );
  const calls = await readProviderCalls();
  expect(calls).toHaveLength(1);
  expect(requestContent(calls[0]?.input)).toMatchObject({ mode: "review", reviewTarget: "PRD-03" });
  expect(calls[0]?.input).not.toContain(customerRequirement);
  await finishProviderCall(0, "Die bestätigte Review hat geantwortet.");
  await expect(panel.$("[role=log]")).toHaveText(expect.stringContaining("Review hat geantwortet"));
  expect(await readViewRoute()).toEqual(overview);
});
