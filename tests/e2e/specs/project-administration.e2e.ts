import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import {
  projectAdministrationRoute,
  projectOverviewRoute,
} from "../../../src/application/projects";
import {
  closeSettings,
  openSettings,
  openView,
  readDataFile,
  readVaultText,
  reloadPlugin,
  ROOT,
  setViewRoute,
  SETTINGS_TAB,
  TEST_LANGUAGE,
  VIEW_TYPE,
} from "../support";

const text = catalogFor(TEST_LANGUAGE).projects;
const first = "project-33333333-3333-4333-8333-000000000001";
const second = "project-33333333-3333-4333-8333-000000000002";
const firstPath = "Produkte/Kundenportal/Project.md";
const secondPath = "Produkte/Admin Console/Project.md";
const protectedPath = "Produkte/Kundenportal/Existing.md";
const sentinel = "---\nexternal: retained\n---\n\nKeep [[Project]].\n";
const movedFolder = "Produkte/Kundenportal Ablage";
const occupiedBase = `${movedFolder}/Imported.base`;
const unrelatedBase = "views:\n  - type: table\n    name: Existing table\n";
const saveDetails = "form:has(input[name=vault_folder]) button[type=submit]";
const project = [
  {
    id: first,
    path: firstPath,
    name: "Kundenportal",
    description: "Serviceprozesse für B2B-Kunden",
    repository: "produktteam/kundenportal",
  },
  {
    id: second,
    path: secondPath,
    name: "Admin Console",
    description: "Rollen und Zugriffe verwalten",
    repository: "produktteam/admin-console",
  },
];

async function openAdministration(id: typeof first | typeof second) {
  await openView();
  await setViewRoute(projectOverviewRoute(id));
  const rail = browser.$(`${ROOT} [data-testid=project-rail]`);
  await rail.$(`button[aria-label=${JSON.stringify(text.administration)}]`).click();
}

before(async () => {
  await browser.executeObsidian(
    async ({ app }, registrations, protectedNote, body, folder, occupiedPath, contents) => {
      await app.vault.createFolder("Produkte");
      for (const { path, id, name, description, repository } of registrations) {
        const parent = path.slice(0, path.lastIndexOf("/"));
        await app.vault.createFolder(parent);
        await app.vault.create(
          path,
          `---\nschema: product-engineering.project/v1\nid: ${id}\nname: ${name}\ndescription: ${description}\nrepository: ${repository}\nbranch: main\nbacklog_base: Backlog.base\nexternal: preserve\n---\n\nRegistration body.\n`,
        );
      }
      await app.vault.create(protectedNote, body);
      await app.vault.createFolder(folder);
      await app.vault.create(occupiedPath, contents);
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    },
    project,
    protectedPath,
    sentinel,
    movedFolder,
    occupiedBase,
    unrelatedBase,
  );
});

it("validates a changed folder and Base while leaving the registration and existing files in place", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await openAdministration(first);
  const folder = workspace.$("input[name=vault_folder]");
  const base = workspace.$("input[name=backlog_base]");
  const save = workspace.$(saveDetails);
  await expect(folder).toBeDisplayed();
  const originalText = await readVaultText(firstPath);
  await folder.setValue("Produkte/Admin Console");
  await save.click();
  await expect(folder).toBeFocused();
  await expect(folder).toHaveAttribute("aria-invalid", "true");
  expect(await readVaultText(firstPath)).toBe(originalText);
  await folder.setValue(movedFolder);
  await base.setValue("Imported.base");
  await save.click();
  await expect(base).toBeFocused();
  await expect(base).toHaveAttribute("aria-invalid", "true");
  expect(await readVaultText(occupiedBase)).toBe(unrelatedBase);
  expect(await readVaultText(firstPath)).toBe(originalText);
  await base.setValue("New Backlog.base");
  await workspace.$("input[name=repository]").click();
  await browser.keys(["Control", "a"]);
  await browser.keys("Backspace");
  await save.click();
  const restore = workspace.$(`button=${text.repairBase}`);
  await expect(restore).toBeDisplayed();
  await browser.waitUntil(async () =>
    (await readVaultText(firstPath))?.includes(`vault_folder: ${movedFolder}`),
  );
  expect(await readVaultText(firstPath)).not.toContain("repository:");
  expect(await readVaultText(`${movedFolder}/Project.md`)).toBeNull();
  expect(await readVaultText(`${movedFolder}/New Backlog.base`)).toBeNull();
  expect(await readVaultText(protectedPath)).toBe(sentinel);
  expect(await readVaultText(occupiedBase)).toBe(unrelatedBase);
  await restore.click();
  await browser.waitUntil(async () =>
    (await readVaultText(`${movedFolder}/New Backlog.base`))?.includes(first),
  );
});

it("saves a project rename in place and reopens both independent registrations", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await openAdministration(first);
  await expect(workspace.$("h1")).toHaveText("Kundenportal");
  const name = workspace.$("input[name=name]");
  await expect(name).toHaveValue("Kundenportal");
  await name.setValue("Kundenportal Plus");
  await workspace.$(saveDetails).click();
  await expect(workspace.$("h1")).toHaveText("Kundenportal Plus");
  expect(await readVaultText(firstPath)).toContain(`id: ${first}`);
  expect(await readVaultText(firstPath)).toContain("external: preserve\n");
  expect(await readVaultText(firstPath)).toContain("---\n\nRegistration body.\n");
  expect(await readVaultText(protectedPath)).toBe(sentinel);
  await reloadPlugin();
  await openAdministration(first);
  await expect(name).toHaveValue("Kundenportal Plus");
  await openAdministration(second);
  await expect(name).toHaveValue("Admin Console");
  expect(await readVaultText(secondPath)).toContain(`id: ${second}`);
});

it("keeps a duplicate team assignment open for correction and saves the corrected member once", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await openAdministration(first);
  const team = workspace.$("[role=tab][data-section=team]");
  await expect(team).toBeDisplayed();
  await team.click();
  const add = workspace.$("button=Mitglied hinzufügen");
  const dialog = browser.$(`${ROOT} [role=dialog][data-state=open]`);
  const name = dialog.$("input[name=name]");
  const submit = dialog.$("button[type=submit]");
  await add.click();
  await name.setValue("Mara König");
  await submit.click();
  await expect(dialog).not.toBeDisplayed();
  const originalText = await readVaultText(firstPath);
  await add.click();
  await name.setValue("Mara König");
  await submit.click();
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Mara König");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.$("form")).toHaveText(expect.stringContaining("bereits"));
  expect(await readVaultText(firstPath)).toBe(originalText);
  await name.setValue("Mara Klein");
  await submit.click();
  await expect(dialog).not.toBeDisplayed();
  await expect(add).toBeFocused();
  await expect(workspace.$("tbody")).toHaveText(expect.stringContaining("Mara Klein"));
  expect((await readVaultText(firstPath))?.match(/Mara Klein/g)).toHaveLength(1);
  await openAdministration(second);
  await team.click();
  await expect(workspace.$("tbody")).not.toBeDisplayed();
});

it("keeps the fixed artifact rules active and persists an optional rule by project after reload", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  const tab = workspace.$("[role=tab][data-section=requirements]");
  const research = workspace.$("input[name=research_jtbd_required]");
  await openAdministration(first);
  await expect(tab).toBeDisplayed();
  await tab.click();
  const fixed = workspace.$$("input[type=checkbox][disabled]");
  await expect(fixed).toBeElementsArrayOfSize(3);
  for (const control of await fixed) await expect(control).toBeSelected();
  await expect(research).toBeSelected();
  await research.click();
  await expect(research).not.toBeSelected();
  await browser.waitUntil(async () =>
    (await readVaultText(firstPath))?.includes("research_jtbd_required: false"),
  );
  await reloadPlugin();
  await openAdministration(first);
  await tab.click();
  await expect(research).not.toBeSelected();
  await openAdministration(second);
  await tab.click();
  await expect(research).toBeSelected();
});

it("keeps empty gate phases usable and versions only meaningful criterion edits", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await openAdministration(first);
  const tab = workspace.$("[role=tab][data-section=definitions]");
  await expect(tab).toBeDisplayed();
  await tab.click();
  const ready = workspace.$("[data-phase=ready]");
  const done = workspace.$("[data-phase=done]");
  const version = workspace.$("[data-rule-version]");
  await expect(ready.$$("li")).toBeElementsArrayOfSize(2);
  await expect(done.$$("li")).toBeElementsArrayOfSize(2);
  await expect(version).toHaveAttribute("data-rule-version", "1");
  await ready.$("button=Kriterium hinzufügen").click();
  const dialog = browser.$(`${ROOT} [role=dialog][data-state=open]`);
  const title = dialog.$("input[name=title]");
  const submit = dialog.$("button[type=submit]");
  await submit.click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toBeFocused();
  await title.setValue("Scope ist dokumentiert");
  await dialog.$("select[name=type]").selectByAttribute("value", "scope");
  await submit.click();
  await expect(version).toHaveAttribute("data-rule-version", "2");
  const saved = await readVaultText(firstPath);
  await ready.$("button=Bearbeiten").click();
  await submit.click();
  await expect(dialog).not.toBeDisplayed();
  await expect(version).toHaveAttribute("data-rule-version", "2");
  expect(await readVaultText(firstPath)).toBe(saved);
  await ready.$("button=Bearbeiten").click();
  await title.setValue("Scope ist abgestimmt");
  await submit.click();
  await expect(version).toHaveAttribute("data-rule-version", "3");
  await expect(ready).toHaveText(expect.stringContaining("Scope ist abgestimmt"));
  await expect(done.$$("li")).toBeElementsArrayOfSize(2);
});

it("lists the registered Knowledge templates in both administration groups", async () => {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await openAdministration(first);
  const tab = workspace.$("[role=tab][data-section=templates]");
  await expect(tab).toBeDisplayed();
  await tab.click();
  const panel = workspace.$(`[id=${JSON.stringify(await tab.getAttribute("aria-controls"))}]`);
  await expect(panel).toHaveText(expect.stringContaining("Produktartefakte"));
  await expect(panel).toHaveText(expect.stringContaining("Konzepte"));
  await expect(panel.$$("button[data-template]")).toBeElementsArrayOfSize(15);
  await expect(panel.$("button[data-template=actor]")).toBeDisplayed();
  await expect(panel.$("button[data-template=test-concept]")).toBeDisplayed();
  await expect(panel.$("button[data-template=pbi]")).not.toExist();
});

it("keeps a dirty draft through a second leaf's save and focuses the conflicting field", async () => {
  await openAdministration(first);
  await browser.executeObsidian(
    async ({ app }, type, route) => {
      const original = app.workspace.getLeavesOfType(type)[0];
      if (!original) throw new Error("The original project leaf is missing");
      original.view.containerEl.dataset.e2e = "project-left";
      const leaf = app.workspace.getLeaf("split", "vertical");
      await leaf.setViewState({ type, active: true, state: { route } });
      leaf.view.containerEl.dataset.e2e = "project-right";
    },
    VIEW_TYPE,
    projectAdministrationRoute(first),
  );
  const left = browser.$(`[data-e2e=project-left] ${ROOT} [data-testid=project-workspace]`);
  const right = browser.$(`[data-e2e=project-right] ${ROOT} [data-testid=project-workspace]`);
  const name = left.$("input[name=name]");
  try {
    await expect(name).toBeDisplayed();
    await name.setValue("Left draft");
    await right.$("input[name=name]").setValue("Right saved");
    await right.$(saveDetails).click();
    await expect(left.$("h1")).toHaveText("Right saved");
    await expect(name).toHaveValue("Left draft");
    await left.$(saveDetails).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("Left draft");
    await expect(right.$("input[name=name]")).toHaveValue("Right saved");
    expect(await readVaultText(firstPath)).toContain("name: Right saved");
    await left.$("button=Gespeicherte Projektdaten übernehmen").click();
    await expect(name).toHaveValue("Right saved");
    const description = left.$("input[name=description]");
    await description.setValue("Disjoint draft");
    await right.$("input[name=branch]").setValue("delivery");
    await right.$(saveDetails).click();
    await browser.waitUntil(async () =>
      (await readVaultText(firstPath))?.includes("branch: delivery"),
    );
    await expect(description).toHaveValue("Disjoint draft");
    await left.$(saveDetails).click();
    await expect(right.$("input[name=description]")).toHaveValue("Disjoint draft");
    expect(await readVaultText(firstPath)).toContain("branch: delivery");
  } finally {
    await browser.executeObsidian(({ app }, type) => {
      app.workspace
        .getLeavesOfType(type)
        .find((leaf) => leaf.view.containerEl.dataset.e2e === "project-right")
        ?.detach();
    }, VIEW_TYPE);
  }
});

it("keeps keyboard focus on the project MCP switch in a 390px leaf and tests the local scope", async () => {
  await openAdministration(second);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 760,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    const owner = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!leaf || !owner) throw new Error("The project leaf is missing");
    app.workspace.getLeaf("split", "vertical");
    await app.workspace.revealLeaf(leaf);
    owner.style.flex = "0 0 390px";
    owner.style.width = "390px";
    leaf.view.containerEl.dataset.e2e = "project-narrow";
  }, VIEW_TYPE);
  const scope = `[data-e2e=project-narrow] ${ROOT}`;
  const workspace = browser.$(`${scope} [data-testid=project-workspace]`);
  const tabs = workspace.$$("button[role=tab]");
  await expect(tabs).toBeElementsArrayOfSize(6);
  const firstTab = workspace.$("[data-section=project]");
  const integration = workspace.$("[data-section=integrations]");
  await firstTab.click();
  await browser.keys("End");
  await expect(integration).toBeFocused();
  await expect(integration).toHaveAttribute("aria-selected", "true");
  const geometry = await browser.execute((selector) => {
    const root = document.querySelector(selector);
    const leaf = root?.closest(".workspace-leaf");
    const tabNodes = [...(root?.querySelectorAll("[role=tab]") ?? [])];
    if (!leaf) throw new Error("No project leaf");
    const bounds = leaf.getBoundingClientRect();
    return {
      width: bounds.width,
      inside: tabNodes.every((tab) => {
        const box = tab.getBoundingClientRect();
        return box.width > 0 && box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
      }),
    };
  }, scope);
  expect(geometry).toEqual({ width: 390, inside: true });
  const result = workspace.$("[data-testid=project-mcp-result]");
  const test = workspace.$("button=MCP-Abfrage testen");
  const toggle = workspace.$("button[role=switch]");
  const globalBefore = await readDataFile();
  await browser.keys("Tab");
  await expect(toggle).toBeFocused();
  await browser.keys("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toBeFocused();
  expect(await readDataFile()).toEqual(globalBefore);
  expect(await readVaultText(secondPath)).toContain("mcp_read: true");
  await test.click();
  await expect(result).toBeDisplayed();
  await expect(result).toHaveAttribute("data-state", "stopped");
  await workspace.$("button=Obsidian-Integrationseinstellungen öffnen").click();
  const mcp = catalogFor(TEST_LANGUAGE).integrations.settings.mcp;
  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);
        if (await browser.$(`div.setting-item-name=${mcp.start}`).isDisplayed()) return true;
      }
      return false;
    },
    { timeoutMsg: "The project action did not open native integration settings" },
  );
  await closeSettings();
  await openSettings();
  await browser.$(SETTINGS_TAB).$(`div.setting-item-name=${mcp.start}`).click();
  await expect(
    browser
      .$(SETTINGS_TAB)
      .$(`div.setting-item-name=${mcp.title}`)
      .$("../..")
      .$(".setting-item-description"),
  ).toHaveText(/127\.0\.0\.1:\d+/);
  await closeSettings();
  await test.click();
  await expect(result).toBeDisplayed();
  await expect(result).toHaveAttribute("data-state", "allowed");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await test.click();
  await expect(result).toBeDisplayed();
  await expect(result).toHaveAttribute("data-state", "denied");
  await openSettings();
  await expect(
    browser
      .$(SETTINGS_TAB)
      .$(`div.setting-item-name=${mcp.title}`)
      .$("../..")
      .$(".setting-item-description"),
  ).toHaveText(/127\.0\.0\.1:\d+/);
  await browser.$(SETTINGS_TAB).$(`div.setting-item-name=${mcp.stop}`).click();
  await closeSettings();
});
