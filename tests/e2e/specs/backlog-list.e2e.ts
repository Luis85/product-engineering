import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { backlogRoute } from "../../../src/application/backlog";
import {
  backlogEntity,
  exportBody,
  existingBase,
  exportPath,
  reviewPath,
  secondText,
  seedBacklogVault,
  work,
} from "../backlog-vault";
import { adminProject, customerProject } from "../knowledge-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute, VIEW_TYPE } from "../support";

const el = (name: string) => browser.$(`${ROOT} [data-testid="${name}"]`);
const row = (key: string) => browser.$(`${ROOT} [data-backlog-key="${key}"]`);

const count = () =>
  browser.executeObsidian(
    ({ app }, folder) =>
      app.vault.getMarkdownFiles().filter(({ path }) => path.startsWith(folder + "/")).length,
    work,
  );

function baseStatus(path: string) {
  const table = browser.$(".workspace-leaf.mod-active .bases-table");
  return table.$(
    `.bases-tr:has([data-href="${path}"]) [data-property="note.DeliveryState"] [contenteditable=true]`,
  );
}

before(() => seedBacklogVault());

it("adopts one note, edits through native Bases and the plugin, and resolves the same product ID after rename", async () => {
  await openView();
  await setViewRoute(backlogRoute(customerProject));
  await expect(row(exportPath).$("[data-testid=backlog-row-state]")).toHaveText(
    expect.stringContaining("Active"),
  );
  expect(await readVaultText(exportPath)).not.toContain("pe-id");
  const files = await count();
  const baseBefore = await readVaultText(existingBase);
  await row(exportPath).$("[data-testid=backlog-row-open]").click();
  await el("backlog-adopt").click();
  await browser.waitUntil(async () => /pe-id: UC-/.test((await readVaultText(exportPath)) ?? ""));
  const adopted = await readVaultText(exportPath);
  const id = /^pe-id: (UC-[a-z0-9-]+)$/m.exec(adopted ?? "")?.[1];
  if (!id) throw new Error("The adopted note has no product ID");
  expect(adopted).toContain("pbl-id: 008");
  expect(adopted).toContain(exportBody);
  expect(adopted).toContain('protected: "exact bytes and # text" # external comment');
  await el("backlog-cancel").click();
  await el("backlog-open-base").click();
  const nativeState = baseStatus(exportPath);
  await expect(nativeState).toBeDisplayed();
  await expect(nativeState).toHaveText("Active");
  await nativeState.setValue("Review");
  await browser.keys("Enter");
  await browser.waitUntil(async () =>
    /DeliveryState: Review/.test((await readVaultText(exportPath)) ?? ""),
  );
  const nativeWrite = await readVaultText(exportPath);
  await openView();
  await expect(row(id).$("[data-testid=backlog-row-state]")).toHaveText(
    expect.stringContaining("Review"),
  );
  await row(id).$("[data-testid=backlog-row-edit]").click();
  await el("backlog-form").$("select[name=state]").selectByVisibleText("Done");
  await el("backlog-save").click();
  await expect(row(id).$("[data-testid=backlog-row-state]")).toHaveText(
    expect.stringContaining("Done"),
  );
  await el("backlog-open-base").click();
  await expect(baseStatus(exportPath)).toHaveText("Done");
  const renamed = work + "/Export außerhalb umbenannt.md";
  await browser.executeObsidian(
    async ({ app }, from, to) => {
      const file = app.vault.getFileByPath(from);
      if (!file) throw new Error("Missing fixture note");
      await app.fileManager.renameFile(file, to);
    },
    exportPath,
    renamed,
  );
  await openView();
  await setViewRoute(backlogRoute(customerProject, id));
  await expect(el("backlog-form").$("select[name=state]")).toHaveValue("Done");
  const current = await readVaultText(renamed);
  expect(current).toContain("pe-id: " + id);
  expect(current).toContain(exportBody);
  expect(current).toBe(nativeWrite?.replace("DeliveryState: Review", "DeliveryState: Done"));
  expect(await readVaultText(reviewPath)).toBe(secondText);
  expect(await readVaultText(existingBase)).toBe(baseBefore);
  expect(await count()).toBe(files);
  await el("backlog-cancel").click();
  await expect(el("backlog-form")).not.toExist();
  await browser.executeObsidian(({ app }, path) => {
    for (const leaf of app.workspace.getLeavesOfType("bases")) {
      if (leaf.view.getState().file === path) leaf.detach();
    }
  }, existingBase);
});

it("shows local identity conflicts and keeps identical short IDs in distinct project scopes", async () => {
  await setViewRoute(backlogRoute(customerProject));
  await expect(el("backlog-duplicates")).toHaveText(expect.stringContaining("FE-99"));
  await expect(row("EP-01").$("[data-testid=backlog-row-open]")).toHaveText("Kundenservice");
  await setViewRoute(backlogRoute(adminProject));
  await expect(row("EP-01").$("[data-testid=backlog-row-open]")).toHaveText("Admin epic");
  await expect(el("backlog-duplicates")).not.toExist();
  await expect(row("FE-01")).not.toExist();
});

it("returns by keyboard from the linked entity to the same filtered feature row", async () => {
  await openView();
  await setViewRoute(backlogRoute(customerProject));
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error("Missing the routed backlog leaf");
    await app.workspace.revealLeaf(leaf);
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, VIEW_TYPE);
  const filter = el("backlog-list").$("input[name=backlog-search]");
  const title = "Servicefälle verwalten";
  await expect(filter).toBeDisplayed();
  await filter.setValue(title);
  const trigger = row("FE-01").$("[data-testid=backlog-row-open]");
  await expect(trigger).toBeDisplayed();
  await browser.execute((element: HTMLElement) => element.focus(), await trigger);
  await browser.keys("Enter");
  const form = el("backlog-form");
  await expect(form.$("input[name=title]")).toHaveValue(title);
  const link = el("domain-scope").$(`[data-domain-scope-link="${backlogEntity}"]`);
  await expect(link).toBeDisplayed();
  await browser.execute((element: HTMLElement) => element.focus(), await link);
  await browser.keys("Enter");
  await expect(el("knowledge-note-header").$("h1")).toHaveText("Organisation");
  await el("project-record-return").click();
  await expect(form.$("input[name=title]")).toHaveValue(title);
  await browser.keys("Escape");
  await expect(form).not.toExist();
  await expect(filter).toHaveValue(title);
  await expect(row("FE-01").$("[data-testid=backlog-row-open]")).toBeFocused();
  expect(await readViewRoute()).toEqual(backlogRoute(customerProject));
});
