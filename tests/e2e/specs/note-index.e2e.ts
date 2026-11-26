import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import {
  openReferenceVault,
  readStartup,
  REFERENCE_RECORDS,
  startupWithVaultReady,
  writeTimingReport,
} from "../reference-vault";
import { installConsoleSpy, pluginProblems, readVaultText, writeVaultText } from "../support";

async function observeBuild(phase: string) {
  await startupWithVaultReady(phase);
  await browser.waitUntil(async () => (await readStartup()).indexReady !== null, {
    timeout: 5_000,
    timeoutMsg: `${phase} reference index did not become ready`,
  });
  const facts = await readStartup();
  const [vault] = facts.host.vault;
  if (!vault || facts.indexReady === null) throw new Error("Expected the vault and index edges");
  const counts = await browser.executeObsidian(({ plugins }) =>
    plugins.noteStoreProbe.events.counts(),
  );
  return { counts, firstCount: facts.indexReady.records, buildMs: facts.indexReady.at - vault.at };
}

async function outsideEdit(path: string, current: string, next: string) {
  const text = await readVaultText(path);
  const title = `title: ${current}\n`;
  if (!text?.includes(title)) throw new Error("Reference note does not have its original title");
  const began = performance.now();
  await writeVaultText(path, text.replace(title, `title: ${next}\n`));
  await browser.waitUntil(
    () =>
      browser.executeObsidian(
        ({ plugins }, file, expected) => plugins.noteStoreProbe.events.titleShown(file, expected),
        path,
        next,
      ),
    {
      interval: 25,
      timeout: 5_000,
      timeoutMsg: `The index did not show the outside edit to ${path}`,
    },
  );
  return performance.now() - began;
}

it("indexes the reference vault after VaultReady and follows edits from the file system", async () => {
  await openReferenceVault();
  const cold = await observeBuild("Cold");
  await browser.reloadObsidian();
  await installConsoleSpy();
  const warm = await observeBuild("Warm");

  const editsMs = [
    await outsideEdit("Items/Item 1.md", "Item 1", "Outside One"),
    await outsideEdit("Entries/Area 1/Entry 1.md", "Entry 1", "Outside Two"),
    await outsideEdit("Items/Item 2.md", "Item 2", "Outside Three"),
  ];
  await writeTimingReport("note-index", { cold, warm, editsMs });
  for (const build of [cold, warm]) {
    expect(build.firstCount).toBe(REFERENCE_RECORDS);
    expect(build.counts).toEqual([
      { type: "item", ready: true, count: 1_000, failed: false },
      { type: "entry", ready: true, count: 1_000, failed: false },
    ]);
    expect(build.buildMs).toBeGreaterThanOrEqual(0);
    expect(build.buildMs).toBeLessThan(1_000);
  }
  for (const milliseconds of editsMs) expect(milliseconds).toBeLessThan(1_000);
  expect(await pluginProblems()).toEqual([]);
}).timeout(160_000);
