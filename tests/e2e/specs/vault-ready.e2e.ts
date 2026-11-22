import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { READINESS_FACTS } from "../../support/notes/fidelity";
import {
  openReferenceVault,
  PROBE_ID,
  readStartup,
  REFERENCE_MARKDOWN,
  REFERENCE_RECORDS,
  startupWithVaultReady,
  writeTimingReport,
} from "../reference-vault";
import { installConsoleSpy, pluginProblems } from "../support";

it("observes VaultReady once after layout, with complete metadata on cold, warm and running starts", async () => {
  await openReferenceVault();
  const cold = await startupWithVaultReady("Cold");
  await browser.reloadObsidian();
  const warm = await startupWithVaultReady("Warm");
  await installConsoleSpy();
  await browser.getObsidianPage().disablePlugin(PROBE_ID);
  await browser.getObsidianPage().enablePlugin(PROBE_ID);
  const running = await startupWithVaultReady("Running");
  await writeTimingReport("vault-ready", { cold, warm, running });

  for (const facts of [cold, warm, running]) {
    expect(facts.host.layout).toHaveLength(1);
    expect(facts.host.vault).toHaveLength(1);
    const [layout] = facts.host.layout;
    const [ready] = facts.host.vault;
    if (!layout || !ready) throw new Error("Expected both native readiness edges");
    expect(ready.at).toBeGreaterThanOrEqual(layout.at);
    expect(ready).toMatchObject({
      markdown: REFERENCE_MARKDOWN,
      cached: REFERENCE_MARKDOWN,
      frontmatter: REFERENCE_RECORDS,
    });
    const completeAtLayout = layout.cached === layout.markdown;
    expect(!completeAtLayout || ready.resolved === layout.resolved).toBe(true);
  }

  const editTrace = await browser.executeObsidian(({ plugins }) =>
    plugins.noteStoreProbe.readinessFacts(),
  );
  expect(editTrace).toEqual(READINESS_FACTS);
  expect((await readStartup()).host.vault).toHaveLength(1);
  expect(await pluginProblems()).toEqual([]);
}).timeout(210_000);
