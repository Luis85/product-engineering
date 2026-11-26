import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { browser } from "@wdio/globals";

export const REFERENCE_MARKDOWN = 2_200;
export const REFERENCE_RECORDS = 2_000;
export const PROBE_ID = "note-store-probe";

export function openReferenceVault(): Promise<void> {
  return browser.reloadObsidian({ vault: "tests/e2e/vaults/reference", plugins: [PROBE_ID] });
}

export function readStartup() {
  return browser.executeObsidian(({ plugins }) => plugins.noteStoreProbe.startup.facts());
}

export async function startupWithVaultReady(phase: string) {
  try {
    await browser.waitUntil(async () => (await readStartup()).host.vault.length > 0, {
      timeout: 75_000,
    });
  } catch (cause) {
    const facts = await readStartup();
    throw new Error(phase + " startup: " + JSON.stringify(facts), { cause });
  }
  return readStartup();
}

export async function writeTimingReport(name: string, facts: unknown): Promise<void> {
  const reports = resolve("reports/e2e");
  await mkdir(reports, { recursive: true });
  await writeFile(
    resolve(reports, `${name}-${browser.sessionId}.json`),
    JSON.stringify(facts, null, 2) + "\n",
    "utf8",
  );
}
