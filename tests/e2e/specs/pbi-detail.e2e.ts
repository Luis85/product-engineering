import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogRoute, pbiDetailRoute } from "../../../src/application/backlog";
import { splitNoteText } from "../../../src/domain/notes";
import { exportPath, sentinel } from "../backlog-vault";
import { customerFolder, customerProject } from "../knowledge-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { pbiChildren, pbiDeclaration, pbiId, pbiTitle, seedPbiVault } from "../pbi-vault";
import { openView, readVaultText, readViewRoute, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const pbiRow = () =>
  browser.$(`${ROOT} [data-backlog-id="${pbiId}"] [data-testid=backlog-row-open]`);
const detail = () => el("pbi-detail");
const heading = () => detail().$("h1");
let repo: Awaited<ReturnType<typeof seedPbiVault>>;

async function activate(element: WebdriverIO.Element) {
  await expect(element).toBeDisplayed();
  await browser.execute((button: HTMLElement) => button.focus(), element);
  await browser.keys("Enter");
}

before(async () => {
  repo = await seedPbiVault();
  await openView();
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail").$("button=Backlog").click();
  await el("backlog-list").$("button=Liste").click();
});

it("opens a canonical PBI from Liste and writes one unassigned companion visible in both surfaces", async () => {
  await activate(await pbiRow());
  await expect(heading()).toHaveText(pbiTitle);
  expect(await readViewRoute()).toEqual(pbiDetailRoute(customerProject, pbiId));
  await expect(el("pbi-parent")).toHaveText(expect.stringContaining("FE-01"));
  await expect(el("pbi-stage")).toHaveText(expect.stringContaining("Active"));
  await expect(el("pbi-factory-status")).toHaveText(expect.stringContaining("Kein Lieferauftrag"));
  await activate(await el("pbi-tab-companions"));
  await activate(await el("pbi-add-companion"));
  await expect(el("pbi-companion-TASK")).toBeFocused();
  await expect(el("pbi-companion-ISS")).toBeDisplayed();
  await expect(el("pbi-companion-BUG")).toBeDisplayed();
  await activate(await el("pbi-companion-Q"));
  const form = el("backlog-form");
  await expect(form.$("input[name=title]")).toBeFocused();
  await expect(form.$("select[name=owner]")).toHaveValue("");
  await form.$("input[name=title]").setValue("Welche Fälle gehören in den Export?");
  await form.$("textarea[name=markdown]").setValue("Klären, ob offene Teilfälle enthalten sind.");
  await activate(await el("backlog-save"));
  await expect(el("pbi-companion-count")).toHaveText("1 offen · 1 insgesamt");
  await browser.waitUntil(async () => (await pbiChildren()).length === 1);
  const [child] = await pbiChildren();
  if (!child) throw new Error("Missing canonical companion fixture");
  expect(child.id).toMatch(/^Q-/);
  const raw = await readVaultText(child.path);
  expect(raw).toContain("type: Question");
  expect(raw).toContain("Klären, ob offene Teilfälle enthalten sind.");
  expect(raw).not.toContain("Steward:");
  const title = "Welche Fälle gehören in den Export?";
  await el("pbi-companion-list")
    .$("button=" + title)
    .click();
  await form.$("select[name=owner]").selectByVisibleText("Mara König");
  await form.$("select[name=state]").selectByVisibleText("Done");
  await el("backlog-save").click();
  await expect(el("pbi-companion-count")).toHaveText("0 offen · 1 insgesamt");
  expect(await readVaultText(child.path)).toContain("Steward: Mara König");
  await el("pbi-companion-list")
    .$("button=" + title)
    .click();
  await form.$("select[name=owner]").selectByVisibleText("Nicht zugewiesen");
  await el("backlog-save").click();
  await expect(form).not.toExist();
  expect(await readVaultText(child.path)).not.toContain("Steward:");
  await el("pbi-return").click();
  await expect(pbiRow()).toBeFocused();
  await expect(browser.$(`${ROOT} [data-backlog-id="${child.id}"]`)).toHaveText(
    expect.stringContaining(title),
  );
  expect(await pbiChildren()).toEqual([child]);
});

it("restores the filtered origin and source link by keyboard after a native note handoff", async () => {
  await setViewRoute(backlogRoute(customerProject));
  const filter = el("backlog-list").$("input[name=backlog-search]");
  await filter.setValue("UC-09");
  await activate(await pbiRow());
  await activate(await el("pbi-tab-links"));
  await activate(await el("pbi-source-prd"));
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await activate(await el("project-record-return"));
  await expect(el("pbi-tab-links")).toHaveAttribute("aria-selected", "true");
  await expect(el("pbi-source-prd")).toBeFocused();
  await activate(await el("pbi-open-note"));
  await browser.waitUntil(() =>
    browser.executeObsidian(
      ({ app }, path) => app.workspace.getActiveFile()?.path === path,
      exportPath,
    ),
  );
  const markdown = browser.$(".workspace-leaf.mod-active .cm-content");
  await expect(markdown).toBeClickable();
  await markdown.click();
  const hostTab = browser.$(".workspace-tab-header[data-type=product-engineering-view]");
  await hostTab.click();
  await activate(await el("pbi-tab-edit"));
  const editor = detail().$("textarea[name=markdown]");
  const original = await readVaultText(exportPath);
  await editor.setValue("## Ungespeicherter Entwurf");
  await activate(await el("pbi-tab-links"));
  await expect(el("knowledge-keep-editing")).toBeFocused();
  await browser.keys("Escape");
  await expect(el("knowledge-keep-editing")).not.toExist();
  await expect(hostTab).toHaveElementClass("is-active");
  await expect(editor).toHaveValue("## Ungespeicherter Entwurf");
  await expect(el("pbi-tab-links")).toBeFocused();
  await el("pbi-cancel-edit").click();
  expect(await readVaultText(exportPath)).toBe(original);
  await activate(await el("pbi-return"));
  await expect(filter).toHaveValue("UC-09");
  await expect(pbiRow()).toBeFocused();
});

it("writes criterion IDs once, approves separately from Git and commits the canonical file", async () => {
  await setViewRoute(pbiDetailRoute(customerProject, pbiId));
  await expect(heading()).toHaveText(pbiTitle);
  await el("pbi-tab-usecase").click();
  await expect(el("pbi-next")).toHaveText("Akzeptanzkriterium ergänzen");
  await activate(await el("pbi-next"));
  await activate(await el("pbi-add-criterion"));
  const criterion = browser.$(`${ROOT} input[name=criterion]`);
  await expect(criterion).toBeFocused();
  await activate(await el("pbi-criterion-save"));
  await expect(el("pbi-criterion-invalid")).toBeDisplayed();
  for (const [field, value] of [
    ["criterion", "Nur offene Treffer exportieren"],
    ["scenario", "Aktive Servicefälle filtern"],
    ["given", "ein offener und ein geschlossener Fall"],
    ["when", "die Agentin den Export auslöst"],
    ["then_step", "enthält die CSV nur den offenen Fall"],
  ] as const) {
    await browser.$(`${ROOT} input[name=${field}]`).setValue(value);
  }
  await activate(await el("pbi-criterion-save"));
  await expect(el("pbi-gherkin")).toHaveText(
    expect.stringContaining("Szenario: Aktive Servicefälle filtern"),
  );
  const spec = await el("pbi-gherkin").getText();
  expect(spec).toMatch(/@UC-09 @AC-[a-f0-9-]+ @SC-[a-f0-9-]+/);
  const download = await browser.execute(
    async (button: HTMLElement, preview: HTMLElement) => {
      const create = URL.createObjectURL.bind(URL);
      const previousUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
      const previousClick = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");
      try {
        let content: Promise<string> | undefined;
        let name: string | undefined;
        URL.createObjectURL = (resource) => {
          if (resource instanceof Blob) content = resource.text();
          return create(resource);
        };
        HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
          name = this.download;
        };
        button.click();
        return { file: { name, content: await content }, text: preview.textContent };
      } finally {
        if (previousUrl) Object.defineProperty(URL, "createObjectURL", previousUrl);
        else Reflect.deleteProperty(URL, "createObjectURL");
        if (previousClick)
          Object.defineProperty(HTMLAnchorElement.prototype, "click", previousClick);
        else Reflect.deleteProperty(HTMLAnchorElement.prototype, "click");
      }
    },
    await el("pbi-download-gherkin"),
    await el("pbi-gherkin"),
  );
  expect(download.file).toEqual({ name: pbiId + ".feature", content: download.text });
  await expect(el("pbi-next")).toHaveText("Use-Case freigeben");
  await activate(await el("pbi-next"));
  await expect(el("pbi-business-status")).toHaveText(expect.stringContaining("Freigegeben"));
  await expect(el("pbi-next")).toHaveText("Ausstehende Änderungen prüfen und committen");
  await expect(el("pbi-stage")).toHaveText(expect.stringContaining("Active"));
  await activate(await el("pbi-next"));
  await expect(el("git-versions").$('[data-git-oid="' + repo.baseline + '"]')).toBeDisplayed();
  await activate(await el("git-commit"));
  const commit = el("git-commit-form");
  await commit.$("input[name=message]").setValue("Genehmigtes PBI festschreiben");
  await commit.$("button[type=submit]").click();
  await expect(el("git-announcement")).toBeDisplayed({ wait: 15_000 });
  const revision = repo.git("rev-parse", "HEAD");
  expect(revision).not.toBe(repo.baseline);
  expect(repo.git("diff-tree", "--no-commit-id", "--name-only", "-r", revision)).toBe(
    pbiDeclaration,
  );
  await expect(el("pbi-ready")).toBeDisplayed({ wait: 15_000 });
  expect(await readVaultText(exportPath)).toContain(sentinel);
  await browser.executeObsidian(async ({ app }, path) => {
    const source = app.vault.getFileByPath(path);
    if (!source) throw new Error("Missing linked PRD fixture");
    await app.vault.process(source, (raw) => raw + "\nWeitere Randbedingung.\n");
  }, customerFolder + "/PRD-03.md");
  await el("pbi-readiness-refresh").click();
  await expect(el("pbi-next")).toHaveText("Ausstehende Änderungen prüfen und committen · PRD-03");
  expect(repo.git("diff", "--name-only")).toBe("PRD-03.md");
  await activate(await el("pbi-next"));
  await expect(el("knowledge-note-header")).toHaveText(expect.stringContaining("PRD-03"));
  await el("project-record-return").click();
  await expect(el("pbi-tab-git")).toHaveAttribute("aria-selected", "true");
  await expect(el("pbi-next")).toBeFocused();
  await el("pbi-tab-edit").click();
  const current = await readVaultText(exportPath);
  if (!current) throw new Error("Missing PBI file after commit");
  const changed = splitNoteText(current).body.replace("## Historie", "## Hauptablauf");
  await detail().$("textarea[name=markdown]").setValue(changed);
  await el("pbi-save").click();
  await expect(el("pbi-business-status")).toHaveText(expect.stringContaining("Entwurf"));
  await expect(el("pbi-stage")).toHaveText(expect.stringContaining("Active"));
  expect(await readVaultText(exportPath)).toContain(
    "[[Servicefälle verwalten|Quelle]] bleibt erhalten.",
  );
  await el("pbi-tab-criteria").click();
  await expect(el("pbi-gherkin")).toHaveText(spec);
});

it("leaves a missing typed PBI in its own project and supplies a return", async () => {
  await setViewRoute(pbiDetailRoute(customerProject, "UC-404"));
  await expect(detail().$("[role=alert]")).toBeDisplayed();
  await el("pbi-return").click();
  await expect(el("backlog-list")).toBeDisplayed();
});

it("keeps six keyboard tabs and preparation within a 390 pixel dark Obsidian leaf", async () => {
  await setViewRoute(pbiDetailRoute(customerProject, pbiId));
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await expect(heading()).toHaveText(pbiTitle);
  const bounds = await browser.execute(
    (element: HTMLElement) => ({
      width: element.closest(".workspace-leaf")?.getBoundingClientRect().width,
      overflow: element.scrollWidth > element.clientWidth,
      tabs: [...element.querySelectorAll('[role="tab"]')].map((entry) => entry.textContent?.trim()),
    }),
    await detail(),
  );
  expect(bounds.width).toBe(390);
  expect(bounds.overflow).toBe(false);
  expect(bounds.tabs).toEqual([
    "Use-Case",
    "Begleititems",
    "Kriterien & Gherkin",
    "Verknüpfungen",
    "Bearbeiten",
    "Git History",
  ]);
  const first = el("pbi-tab-usecase");
  await browser.execute((button: HTMLElement) => button.focus(), await first);
  await browser.keys("End");
  await expect(el("pbi-tab-git")).toBeFocused();
  await browser.keys("Enter");
  await expect(el("pbi-tab-git")).toHaveAttribute("aria-selected", "true");
  await el("pbi-open-note").scrollIntoView();
  await expect(el("pbi-open-note")).toBeClickable();
});
