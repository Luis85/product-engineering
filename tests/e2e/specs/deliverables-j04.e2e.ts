import { execFileSync } from "node:child_process";
import { mkdtemp, rmdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogBoardRoute, nfrCatalogRoute } from "../../../src/application/backlog";
import { fixtureGitEnv } from "../../support/git-fixture";
import { exportPath, seedBacklogVault } from "../backlog-vault";
import { customerFolder, customerProject, vision } from "../knowledge-vault";
import { openView, readVaultText, reloadPlugin, ROOT, setViewRoute } from "../support";

const el = (test: string) => browser.$(`${ROOT} [data-testid="${test}"]`);
const rowControl = (row: number, test: string) =>
  el("deliverables").$(`[data-deliverable-id]:nth-child(${row}) [data-testid="${test}"]`);
const route = { name: "project-backlog", projectId: customerProject, tab: "deliverables" };
const outputFolder = customerFolder + "/Deliverables/";
const title = "Dienstbereitschaft und Übergabe";
const existingPath = customerFolder + "/VIS-01.md";
const opsPath = customerFolder + "/" + title + ".md";

const listPaths = (folder: string) =>
  browser.executeObsidian(
    ({ app }, prefix) =>
      app.vault
        .getMarkdownFiles()
        .filter(({ path }) => path.startsWith(prefix))
        .map(({ path }) => path)
        .toSorted(),
    folder,
  );

async function importQuotedCsv() {
  await openView();
  await setViewRoute(nfrCatalogRoute(customerProject));
  const temporary = await mkdtemp(join(tmpdir(), "pe-j04-"));
  const path = join(temporary, "anforderungen.csv");
  const header = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";
  const invalid = `\uFEFF${header}\r\nIndex;"Die Suche liefert ""Treffer""; mobil.";"Unter 100 ms\r\nin 20 Tests";;performance-efficiency\r\nExport;"Sicher\r\nexportieren";Keine fremden Fälle;;27001:security`;
  const corrected = invalid.replace("27001:security", "27001:technological");
  const confirm = el("nfr-csv-confirm");
  const source = el("nfr-csv-source");
  const preview = el("nfr-preview");
  const nfrFolder = customerFolder + "/NFRs/";
  try {
    await writeFile(path, invalid, "utf8");
    await el("nfr-import").click();
    await el("nfr-csv-file").setValue(path);
    await expect(source).toHaveValue(expect.stringContaining("27001:security"));
    await el("nfr-csv-preview").click();
    await expect(preview).toHaveText(expect.stringContaining("Zeile 4"));
    await expect(preview).toHaveText(expect.stringContaining("27001:security"));
    await expect(confirm).toBeDisabled();
    expect(await listPaths(nfrFolder)).toEqual([]);
    await source.setValue(corrected);
    await expect(confirm).not.toExist();
    await el("nfr-csv-preview").click();
    await expect(preview).toHaveText(
      expect.stringContaining('Die Suche liefert "Treffer"; mobil.'),
    );
    await expect(preview).toHaveText(expect.stringContaining("Unter 100 ms"));
    await expect(preview).toHaveText(expect.stringContaining("in 20 Tests"));
    await expect(preview).toHaveText(expect.stringContaining("ISO/IEC 25010:2023"));
    await expect(preview).toHaveText(expect.stringContaining("ISO/IEC 27001:2022"));
    await expect(confirm).toHaveText("2 NFR importieren");
    await confirm.click();
    await expect(el("nfr-feedback")).toHaveText("2 importiert · 0 bereits vorhanden");
    const imported = await listPaths(nfrFolder);
    expect(imported).toHaveLength(2);
    for (const notePath of imported)
      expect(await readVaultText(notePath)).not.toContain("owner_id:");
    await el("nfr-import").click();
    await source.setValue(corrected);
    await el("nfr-csv-preview").click();
    await expect(confirm).toHaveText("0 NFR importieren");
    await expect(confirm).toBeDisabled();
    await browser.keys("Escape");
    expect(await listPaths(nfrFolder)).toEqual(imported);
  } finally {
    await rm(path, { force: true });
    await rmdir(temporary);
  }
}

async function track(name: string, template: string, linked?: string) {
  await el("deliverable-create").click();
  await expect(el("deliverable-owner")).toHaveValue("");
  await el("deliverable-title").setValue(name);
  await el("deliverable-outcome").setValue("Das Team kann den Lieferstand belegen.");
  await el("deliverable-template").selectByAttribute("value", template);
  if (linked) await el("deliverable-knowledge").selectByAttribute("value", linked);
  await el("deliverable-save").click();
  await expect(el("deliverable-editor")).not.toExist();
}

function gitFixture() {
  const path = browser.getObsidianPage().getVaultPath();
  const cwd = join(path, customerFolder);
  const env = fixtureGitEnv(join(cwd, ".git", "no-global-config"));
  const run = (...args: string[]) =>
    execFileSync("git", ["--literal-pathspecs", ...args], { cwd, env }).toString();
  run("init", "--initial-branch=main", "--quiet");
  run("config", "user.name", "J04 fixture");
  run("config", "user.email", "fixture@example.invalid");
  run("config", "core.autocrlf", "false");
  const tracked = [existingPath, opsPath, exportPath].map((file) =>
    file.slice(customerFolder.length + 1),
  );
  run("add", "--", ...tracked);
  run("commit", "--quiet", "-m", "Capture note and PBI baseline");
  return () => ({
    head: run("rev-parse", "HEAD"),
    working: run("diff", "--binary", "--", ...tracked),
    index: run("diff", "--cached", "--binary", "--", ...tracked),
  });
}

async function followBacklink(name: string) {
  await el("knowledge-references-tab").click();
  await expect(el("knowledge-deliverable-backlink")).toHaveText(expect.stringContaining(name));
  await el("knowledge-deliverable-backlink").click();
  await expect(el("deliverable-title")).toHaveValue(name);
  await expect(el("deliverable-owner")).toHaveValue("");
  await browser.keys("Escape");
  await expect(el("deliverable-editor")).not.toExist();
}

before(() => seedBacklogVault());

it("completes J04 from the actual quoted CSV to both deliverable backlinks and independent completion", async () => {
  await importQuotedCsv();
  await el("backlog-tab-deliverables").click();
  await expect(el("deliverable-empty")).toBeDisplayed();
  await track("Produktvision belegen", "vision", vision);
  await track("Betriebshandbuch übergeben", "operations-concept");
  await rowControl(1, "deliverable-open-note").click();
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("Freigegeben"));
  await followBacklink("Produktvision belegen");
  await rowControl(2, "deliverable-create-note").click();
  const draft = browser.$(`${ROOT} [role="dialog"] form`);
  await expect(draft.$('[name="kind"]')).toHaveValue("operations-concept");
  await expect(draft.$('[name="owner_id"]')).toHaveValue("");
  await draft.$('[name="title"]').setValue(title);
  await draft.$('button[type="submit"]').click();
  await expect(browser.$(`${ROOT} textarea[name="markdown"]`)).toBeDisplayed();
  await browser
    .$(`${ROOT} textarea[name="markdown"]`)
    .setValue("## Bereitschaft\n\nDer Dienst prüft die Störung.");
  await el("knowledge-save").click();
  await expect(el("knowledge-save")).toBeDisabled();
  await followBacklink("Betriebshandbuch übergeben");

  const outputs = await listPaths(outputFolder);
  expect(outputs).toHaveLength(2);
  const completed = outputs[1];
  if (!completed) throw new Error("Missing second deliverable");
  for (const path of outputs) expect(await readVaultText(path)).not.toContain("owner_id:");
  const existing = await readVaultText(existingPath);
  const proof = await readVaultText(opsPath);
  const planning = await readVaultText(exportPath);
  expect(existing).toContain("approval: approved");
  expect(proof).toContain("approval: draft");
  expect(proof).toContain("display_id: OPS-01");
  expect(proof).toContain("Der Dienst prüft die Störung.");
  expect(proof).not.toContain("owner_id:");
  expect(planning).toContain("DeliveryState: Active");
  const gitState = gitFixture();
  const baseline = gitState();
  await rowControl(2, "deliverable-row-status").selectByAttribute("value", "done");
  await browser.waitUntil(
    async () => (await readVaultText(completed))?.includes("status: done") ?? false,
  );
  expect(gitState()).toEqual(baseline);
  expect(await readVaultText(existingPath)).toBe(existing);
  expect(await readVaultText(opsPath)).toBe(proof);
  expect(await readVaultText(exportPath)).toBe(planning);

  await reloadPlugin();
  await openView();
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(browser.$(`${ROOT} [data-board-stage="In Progress"]`)).toHaveText(
    expect.stringContaining("Gefilterte Servicefälle exportieren"),
  );
  await setViewRoute(route);
  await expect(rowControl(1, "deliverable-open-note")).toHaveText("Durchgängiger Kundenservice");
  await expect(rowControl(2, "deliverable-open-note")).toHaveText(title);
  await expect(rowControl(2, "deliverable-row-status")).toHaveValue("done");
  await expect(rowControl(2, "deliverable-row-owner")).toHaveText("Nicht zugewiesen");
  expect(await listPaths(outputFolder)).toEqual(outputs);
});
