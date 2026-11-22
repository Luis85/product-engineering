import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import type NoteStoreProbe from "../probe-plugin/main";
import { READINESS_FACTS, STORE_FACTS, VAULT_FACTS } from "../../support/notes/fidelity";
import { installConsoleSpy, pluginProblems } from "../support";

declare module "wdio-obsidian-service" {
  interface InstalledPlugins {
    noteStoreProbe: NoteStoreProbe;
  }
}

it("matches the Obsidian vault and note-store contracts on the live host", async () => {
  await installConsoleSpy();
  const facts = await browser.executeObsidian(({ plugins }) => plugins.noteStoreProbe.vaultFacts());
  expect(facts).toEqual(VAULT_FACTS);
  const store = await browser.executeObsidian(({ plugins }) => plugins.noteStoreProbe.storeFacts());
  expect(store).toEqual(STORE_FACTS);
  const readiness = await browser.executeObsidian(({ plugins }) =>
    plugins.noteStoreProbe.readinessFacts(),
  );
  expect(readiness).toEqual(READINESS_FACTS);
  expect(await pluginProblems()).toEqual([]);
});
