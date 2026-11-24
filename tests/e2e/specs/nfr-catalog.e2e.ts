import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogBoardRoute, backlogRoute } from "../../../src/application/backlog";
import { featurePath, seedBacklogVault } from "../backlog-vault";
import { adminProject, customerFolder, customerProject } from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setViewRoute,
} from "../support";

const el = (test: string) => browser.$(`${ROOT} [data-testid="${test}"]`);
const header = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";
const pasted = `\uFEFF${header}\r\nIndex;"Die Suche liefert ""Treffer""; mobil.";"Unter 100 ms\r\nin 20 Tests";;performance-efficiency|27001:technological`;
const route = (projectId = customerProject) => ({
  name: "project-backlog",
  projectId,
  tab: "nfrs",
});
const press = async (test: string, key = "Enter") => {
  await browser.execute((element: HTMLElement) => element.focus(), await el(test));
  await browser.keys(key);
};
const nfrPaths = () =>
  browser.executeObsidian(
    ({ app }, folder) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(folder + "/NFRs/"))
        .map(({ path }) => path)
        .toSorted(),
    customerFolder,
  );

before(() => seedBacklogVault());

it("opens the third tab and cancels a keyboard CSV preview without writing", async () => {
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(el("backlog-tab-nfrs")).toBeDisplayed();
  await press("backlog-tab-nfrs");
  expect(await readViewRoute()).toEqual(route());
  await expect(el("nfr-catalog").$("h2")).toHaveText("Nichtfunktionale Anforderungen");
  await press("nfr-import");
  const source = el("nfr-csv-source");
  await expect(source).toBeFocused();
  await browser.sendCommandAndGetResult("Input.insertText", { text: pasted });
  await expect(source).toHaveValue(expect.stringContaining("in 20 Tests"));
  await press("nfr-csv-preview");
  await expect(el("nfr-preview")).toHaveText(
    expect.stringContaining('Die Suche liefert "Treffer"; mobil.'),
  );
  await expect(el("nfr-preview")).toHaveText(expect.stringContaining("ISO/IEC 25010:2023"));
  await expect(el("nfr-preview")).toHaveText(expect.stringContaining("ISO/IEC 27001:2022"));
  await browser.keys("Escape");
  await expect(source).not.toExist();
  await expect(el("nfr-import")).toBeFocused();
  expect(await nfrPaths()).toEqual([]);
});

it("invalidates stale project and source previews, then creates a canonical note and reopens it after rename and reload", async () => {
  await setViewRoute(route());
  await el("nfr-import").click();
  const source = el("nfr-csv-source");
  await source.setValue(pasted);
  await el("nfr-csv-preview").click();
  await expect(el("nfr-csv-confirm")).toBeEnabled();
  await source.setValue(pasted + "\n");
  await expect(el("nfr-csv-confirm")).not.toExist();
  await el("nfr-csv-preview").click();
  await expect(el("nfr-csv-confirm")).toBeEnabled();
  await setViewRoute(route(adminProject));
  await expect(el("nfr-csv-confirm")).not.toExist();
  expect(await nfrPaths()).toEqual([]);
  await setViewRoute(route());
  await el("nfr-import").click();
  await source.setValue(pasted);
  await el("nfr-csv-preview").click();
  await el("nfr-csv-confirm").click();
  await expect(el("nfr-row-open")).toHaveText("Index");
  const [path] = await nfrPaths();
  if (!path) throw new Error("Missing imported NFR");
  const original = await readVaultText(path);
  const id = /^id: (nfr-[a-z0-9-]+)$/m.exec(original ?? "")?.[1];
  if (!id) throw new Error("Missing canonical NFR identity");
  const renamed = customerFolder + "/NFRs/Außerhalb.md";
  await browser.executeObsidian(
    async ({ app }, from, to) => {
      const file = app.vault.getFileByPath(from);
      if (!file) throw new Error("Missing NFR to rename");
      await app.fileManager.renameFile(file, to);
    },
    path,
    renamed,
  );
  await reloadPlugin();
  await openView();
  await setViewRoute({ ...route(), nfr: id });
  await expect(el("nfr-title")).toHaveValue("Index");
  await expect(el("nfr-acceptance")).toHaveValue("Unter 100 ms\nin 20 Tests");
  await expect(el("nfr-owner")).toHaveValue("");
  expect(await readVaultText(renamed)).toBe(original);
  expect(await nfrPaths()).toEqual([renamed]);
  await browser.keys("Escape");
  await expect(el("nfr-row-open")).toBeFocused();
});

it("cancels a nested picker without losing the draft, then follows reciprocal scoped links and restores focus", async () => {
  await setViewRoute(backlogRoute(customerProject));
  const openFeature = browser.$(
    `${ROOT} [data-backlog-key="FE-01"] [data-testid=backlog-row-open]`,
  );
  const title = el("backlog-form").$("input[name=title]");
  const source = browser.$(`${ROOT} [data-nfr-source="item:FE-01"]`);
  const choose = browser.$(`${ROOT} [data-testid="nfr-assignment-picker"] input[type=checkbox]`);
  const noteBefore = await readVaultText(featurePath);
  await openFeature.click();
  await title.setValue("Entwurf bleibt beim Abbrechen");
  await press("nfr-assign");
  await expect(el("nfr-assignment-picker")).toBeDisplayed();
  await expect(choose).toBeFocused();
  await browser.keys("Space");
  await expect(choose).toBeSelected();
  await browser.keys("Escape");
  await expect(choose).not.toExist();
  await expect(title).toHaveValue("Entwurf bleibt beim Abbrechen");
  await expect(el("nfr-assign")).toBeFocused();
  await press("nfr-assign");
  await expect(choose).not.toBeSelected();
  await browser.keys("Space");
  await press("nfr-assign-save");
  const linked = source.$("[data-nfr-open-record]");
  await expect(linked).toHaveText("Index");
  await expect(title).toHaveValue("Entwurf bleibt beim Abbrechen");
  await linked.click();
  await el("knowledge-keep-editing").click();
  await expect(title).toHaveValue("Entwurf bleibt beim Abbrechen");
  await linked.click();
  await el("knowledge-discard-leave").click();
  await expect(el("nfr-acceptance")).toHaveValue("Unter 100 ms\nin 20 Tests");
  await browser.keys("Escape");
  await expect(linked).toBeFocused();
  await expect(title).toHaveValue("Servicefälle verwalten");
  expect(await readVaultText(featurePath)).toBe(noteBefore);
  await browser.keys("Escape");
  await expect(openFeature).toBeFocused();
  const [nfr] = await nfrPaths();
  if (!nfr) throw new Error("Missing assigned catalog note");
  const saved = await readVaultText(nfr);
  expect(saved).toContain("FE-01");
  await setViewRoute(route());
  await el("nfr-row-open").click();
  const peer = browser.$(`${ROOT} [data-nfr-open-target="item:FE-01"]`);
  await peer.click();
  await expect(linked).toHaveText("Index");
  await browser.keys("Escape");
  await expect(peer).toBeFocused();
  await browser.keys("Escape");
  expect(await readVaultText(nfr)).toBe(saved);
});

it("loads a local UTF-8 CSV, then recovers a partial native refusal without replacing the first note", async () => {
  await setViewRoute(route());
  const directory = await mkdtemp(join(tmpdir(), "pe-nfr-"));
  const file = join(directory, "anforderungen.csv");
  const invalid = `\uFEFF${header}\r\nBatch erster;Anforderung;Kriterium;Mara König;ISO 25010:Leistungseffizienz\r\nBatch zweiter;"Sicher\r\nexportieren";Keine fremden Fälle;;27001:security`;
  const csv = invalid.replace("27001:security", "27001:technological");
  const originalPaths = await nfrPaths();
  try {
    await writeFile(file, invalid, "utf8");
    await el("nfr-import").click();
    await el("nfr-csv-file").setValue(file);
    const source = el("nfr-csv-source");
    await expect(source).toHaveValue(expect.stringContaining("Batch zweiter"));
    await el("nfr-csv-preview").click();
    const confirm = el("nfr-csv-confirm");
    await expect(el("nfr-preview")).toHaveText(expect.stringContaining("Zeile 3"));
    await expect(el("nfr-preview")).toHaveText(expect.stringContaining("27001:security"));
    await expect(confirm).toBeDisabled();
    expect(await nfrPaths()).toEqual(originalPaths);
    await source.setValue(csv);
    await expect(confirm).not.toExist();
    await el("nfr-csv-preview").click();
    await expect(confirm).toHaveText("2 NFR importieren");
    await browser.executeObsidian(({ app }) => {
      const create = app.vault.create.bind(app.vault);
      app.vault.create = async (path, ...args) => {
        if (path.includes("/NFRs/Batch zweiter")) {
          app.vault.create = create;
          throw new Error("Controlled native refusal");
        }
        return create(path, ...args);
      };
    });
    await confirm.click();
    await expect(browser.$(`${ROOT} [role=dialog] [role=alert]`)).toBeDisplayed();
    const existing = await nfrPaths();
    const first = existing.find((path) => path.includes("/Batch erster"));
    if (!first) throw new Error("Missing first committed batch note");
    expect(existing.some((path) => path.includes("/Batch zweiter"))).toBe(false);
    const outside = (await readVaultText(first)) + "\n# Außerhalb ergänzt\n";
    await browser.executeObsidian(
      async ({ app }, path, content) => {
        const note = app.vault.getFileByPath(path);
        if (!note) throw new Error("Missing batch note");
        await app.vault.modify(note, content);
      },
      first,
      outside,
    );
    await confirm.click();
    await expect(el("nfr-feedback")).toHaveText("1 importiert · 1 bereits vorhanden");
    expect(await readVaultText(first)).toBe(outside);
    expect((await nfrPaths()).filter((path) => path.includes("/Batch "))).toHaveLength(2);
    await el("nfr-import").click();
    await source.setValue(csv);
    await el("nfr-csv-preview").click();
    await expect(confirm).toHaveText("0 NFR importieren");
    await expect(confirm).toBeDisabled();
    await browser.keys("Escape");
  } finally {
    await rm(file, { force: true });
    await rmdir(directory);
  }
});
