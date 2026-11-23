import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogRoute } from "../../../src/application/backlog";
import { newNoteText } from "../../../src/domain/notes";
import { featurePath, seedBacklogVault, work } from "../backlog-vault";
import { customerProject } from "../knowledge-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";

const title = "Servicefälle verwalten";
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const markdown = () => browser.$(".workspace-leaf.mod-active .cm-content");
const projectTab = () => browser.$(".workspace-tab-header-inner-title=Product Engineering");
const projectHostTab = () => browser.$(".workspace-tab-header[data-type=product-engineering-view]");
const filter = () => el("backlog-list").$("input[name=backlog-search]");
const trigger = () => browser.$(`${ROOT} [data-backlog-key=FE-01] [data-testid=backlog-row-open]`);
const titleInput = () => el("backlog-form").$("input[name=title]");

function activeFile() {
  return browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path);
}

function closeFixtureNoteTabs() {
  return browser.executeObsidian(({ app }, path) => {
    for (const leaf of app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view.getState().file === path) leaf.detach();
    }
  }, featurePath);
}

async function returnToProject() {
  await expect(projectTab()).toBeClickable();
  await projectTab().click();
  await expect(filter()).toBeDisplayed();
  await closeFixtureNoteTabs();
}

async function leaveNativeTabOpen() {
  await trigger().click();
  await el("backlog-open-note").click();
  await browser.waitUntil(async () => (await activeFile()) === featurePath);
  await expect(markdown()).toBeClickable();
  await markdown().click();
  await projectHostTab().click();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await expect(trigger()).toBeClickable();
}

async function renameFixture(from: string, to: string) {
  await browser.executeObsidian(
    async ({ app }, previous, next) => {
      const file = app.vault.getFileByPath(previous);
      if (!file) throw new Error("Missing feature fixture");
      await app.vault.rename(file, next);
    },
    from,
    to,
  );
}

before(async () => {
  await seedBacklogVault();
  const peers = [
    {
      path: `${work}/Support-Aufwand senken.md`,
      text: newNoteText(
        { type: "Epic", "pe-id": "EP-02", project_id: customerProject, order: 5000 },
        "",
      ),
    },
    {
      path: `${work}/Support-Inbox.md`,
      text: newNoteText(
        {
          type: "Feature",
          "pe-id": "FE-03",
          project_id: customerProject,
          parent: "[[Support-Aufwand senken]]",
          order: 7000,
        },
        "",
      ),
    },
  ];
  await browser.executeObsidian(async ({ app }, notes) => {
    for (const { path, text } of notes) await app.vault.create(path, text);
  }, peers);
  await openView();
  await browser.$(ROOT).$("button=Kundenportal").click();
  await el("project-rail").$("button=Backlog").click();
  await expect(trigger()).toBeClickable();
});

it("keeps the origin row focused on Escape after a visible note round trip with the native tab open", async () => {
  const original = await readVaultText(featurePath);
  await leaveNativeTabOpen();
  await trigger().click();
  const form = el("backlog-form");
  const parent = form.$("select[name=parent]");
  await browser.execute((control: HTMLElement) => control.focus(), await parent);
  await browser.keys("End");
  await expect(form.$("output")).toHaveText("Position 2 von 2");
  await browser.execute((control: HTMLElement) => control.focus(), await el("backlog-up"));
  await browser.keys("Enter");
  await expect(el("backlog-down")).toBeFocused();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await browser.keys("Escape");
  await expect(form).not.toExist();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await expect(trigger()).toBeFocused();
  expect(await readVaultText(featurePath)).toBe(original);
  const openFile = await browser.executeObsidian(
    ({ app }, path) =>
      app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view.getState().file === path),
    featurePath,
  );
  expect(openFile).toBe(true);
  await closeFixtureNoteTabs();
});

it("keeps chooser Escape local and allows host Escape in the plain list", async () => {
  await leaveNativeTabOpen();
  const create = el("backlog-new");
  await create.click();
  await expect(el("backlog-create-UC")).toBeFocused();
  await browser.keys("Escape");
  await expect(el("backlog-create-UC")).not.toExist();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await expect(create).toBeFocused();

  await browser.keys("Escape");
  await browser.waitUntil(async () => (await activeFile()) === featurePath);
  await projectHostTab().click();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await closeFixtureNoteTabs();
});

it("keeps nested guard Escape in the dirty editor after a native note round trip", async () => {
  const original = await readVaultText(featurePath);
  await leaveNativeTabOpen();
  await trigger().click();
  const draft = title + " Entwurf";
  await titleInput().setValue(draft);
  const history = el("backlog-open-history");
  await history.click();
  const keep = el("knowledge-keep-editing");
  await expect(keep).toBeFocused();
  await browser.keys("Escape");
  await expect(keep).not.toExist();
  await expect(projectHostTab()).toHaveElementClass("is-active");
  await expect(titleInput()).toHaveValue(draft);
  await expect(history).toBeFocused();

  await el("backlog-cancel").click();
  await expect(trigger()).toBeFocused();
  expect(await readVaultText(featurePath)).toBe(original);
  await closeFixtureNoteTabs();
});

it("releases the editor so the opened native note and the project tab receive pointer input", async () => {
  await openView();
  await setViewRoute(backlogRoute(customerProject));
  await expect(filter()).toBeDisplayed();
  await filter().setValue(title);
  await trigger().click();
  const original = await readVaultText(featurePath);
  await el("backlog-open-note").click();
  await browser.waitUntil(async () => (await activeFile()) === featurePath);
  await expect(markdown()).toBeDisplayed();
  await expect(markdown()).toBeClickable();
  await expect(projectTab()).toBeClickable();
  await expect(el("backlog-form")).not.toExist();
  expect(await readVaultText(featurePath)).toBe(original);
  await markdown().click();
  await expect(markdown()).toBeFocused();
  await returnToProject();
  await expect(filter()).toHaveValue(title);
  await expect(trigger()).toBeDisplayed();
  expect(await readViewRoute()).toEqual(backlogRoute(customerProject));
});

it("guards a draft and opens the saved canonical note from a typed editor route", async () => {
  await setViewRoute(backlogRoute(customerProject));
  await expect(filter()).toBeDisplayed();
  await filter().setValue(title);
  await setViewRoute(backlogRoute(customerProject, "FE-01"));
  await expect(titleInput()).toHaveValue(title);
  const original = await readVaultText(featurePath);
  const updated = title + " prüfen";
  await titleInput().setValue(updated);
  await el("backlog-open-note").click();
  await el("knowledge-keep-editing").click();
  await expect(el("knowledge-keep-editing")).not.toExist();
  await expect(titleInput()).toHaveValue(updated);
  expect(await readVaultText(featurePath)).toBe(original);
  await el("backlog-open-note").click();
  await el("knowledge-save-leave").click();
  await browser.waitUntil(async () => (await activeFile()) === featurePath);
  await expect(markdown()).toBeClickable();
  await expect(markdown()).toBeFocused();
  await expect(el("backlog-form")).not.toExist();
  const saved = await readVaultText(featurePath);
  expect(saved).toContain("title: " + updated);
  expect(saved).toContain("pe-id: FE-01");
  expect(saved).toContain("## Servicefälle");
  await returnToProject();
  await expect(filter()).toHaveValue(title);
  await expect(trigger()).toHaveText(updated);
  expect(await readViewRoute()).toEqual(backlogRoute(customerProject));
});

it("keeps the editor available if the note cannot open and supports retry after it returns", async () => {
  await setViewRoute(backlogRoute(customerProject));
  await expect(trigger()).toBeDisplayed();
  const expected = await trigger().getText();
  await trigger().click();
  await expect(titleInput()).toHaveValue(expected);
  const original = await readVaultText(featurePath);
  const temporary = featurePath.replace(/\.md$/, " (vorübergehend).md");
  await renameFixture(featurePath, temporary);
  try {
    await el("backlog-open-note").click();
    const error = browser.$(`${ROOT} [role=dialog]:has([data-testid=backlog-form]) [role=alert]`);
    await expect(error).toHaveText(expect.stringContaining("Notiz nicht verfügbar"));
    await expect(titleInput()).toHaveValue(expected);
    await expect(titleInput()).toBeClickable();
    expect(await readVaultText(temporary)).toBe(original);
  } finally {
    await renameFixture(temporary, featurePath);
  }
  await el("backlog-open-note").click();
  await browser.waitUntil(async () => (await activeFile()) === featurePath);
  await expect(markdown()).toBeClickable();
  await expect(el("backlog-form")).not.toExist();
});
