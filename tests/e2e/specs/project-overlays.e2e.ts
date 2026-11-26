import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import {
  installConsoleSpy,
  openView,
  pluginProblems,
  ROOT,
  TEST_LANGUAGE,
  VIEW_TYPE,
  writeDataFile,
} from "../support";

const root = `[data-e2e=project-overlay-leaf] ${ROOT}`;
const catalog = catalogFor(TEST_LANGUAGE);
const text = catalog.projects;
const dialog = "[role=dialog][data-state=open]";

function named(scope: string, name: string) {
  return browser.$(`${scope} button[aria-label=${JSON.stringify(name)}]`);
}

async function project() {
  const workspace = browser.$(`${ROOT} [data-testid=project-workspace]`);
  await workspace.$(`button=${text.create}`).click();
  const form = browser.$(`${ROOT} ${dialog}`);
  await form.$("input[name=name]").setValue("Kundenportal");
  await form.$("input[name=description]").setValue("Serviceprozesse für B2B-Kunden");
  await form.$("input[name=repository]").setValue("produktteam/kundenportal");
  await form.$("button[type=submit]").click();
  await expect(workspace.$("h1")).toHaveText("Kundenportal");
}

async function narrowLeaf() {
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    const container = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!leaf || !container) throw new Error("The project leaf is missing");
    leaf.view.containerEl.dataset.e2e = "project-overlay-leaf";
    app.workspace.getLeaf("split", "vertical");
    await app.workspace.revealLeaf(leaf);
    container.style.flex = "0 0 390px";
    container.style.width = "390px";
  }, VIEW_TYPE);
}

async function expectInsideLeaf(title: string) {
  const panel = await browser.execute(
    (selector, activeDialog, name) => {
      const scope = document.querySelector(selector);
      const owner = scope?.closest(".workspace-leaf");
      const selected = Array.from(scope?.querySelectorAll(activeDialog) ?? []).find((node) => {
        const label = node.getAttribute("aria-labelledby");
        return label && node.ownerDocument.getElementById(label)?.textContent?.trim() === name;
      });
      if (!owner || !selected) throw new Error("Expected the visible dialog and its owning leaf");
      const bounds = (node: Element) => {
        const { left, right, top, bottom, width } = node.getBoundingClientRect();
        return { left, right, top, bottom, width };
      };
      return { leaf: bounds(owner), overlay: bounds(selected) };
    },
    root,
    dialog,
    title,
  );
  expect(panel.leaf.width).toBe(390);
  expect(panel.overlay.left).toBeGreaterThanOrEqual(panel.leaf.left - 1);
  expect(panel.overlay.right).toBeLessThanOrEqual(panel.leaf.right + 1);
  expect(panel.overlay.top).toBeGreaterThanOrEqual(panel.leaf.top - 1);
  expect(panel.overlay.bottom).toBeLessThanOrEqual(panel.leaf.bottom + 1);
}

before(async () => {
  await installConsoleSpy();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 460,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await browser.executeObsidian(({ app }) => {
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  });
  await openView();
  await project();
  await narrowLeaf();
});

it("keeps project overlays inside a physically narrow and short Obsidian leaf", async () => {
  const drawer = named(root, text.openNavigation);
  const picker = named(`${root} ${dialog}`, text.picker);
  await drawer.click();
  await expect(picker).toBeFocused();
  await expectInsideLeaf(text.navigation);

  await picker.click();
  const projects = browser.$(`${root} ${dialog}:has([aria-current=true])`);
  await projects.waitForDisplayed();
  await expectInsideLeaf(text.title);
  await browser.keys("Escape");
  await expect(picker).toBeFocused();
  await browser.keys("Escape");
  await expect(drawer).toBeFocused();

  const search = named(root, text.search.open);
  await search.click();
  await expect(browser.$(`${root} ${dialog} input[type=search]`)).toBeFocused();
  await expectInsideLeaf(text.search.title("Kundenportal"));
  await browser.keys("Escape");
  await expect(search).toBeFocused();

  await drawer.click();
  await picker.click();
  await projects.$(`button=${text.create}`).click();
  const form = browser.$(`${root} ${dialog} input[name=name]`);
  await expect(form).toBeFocused();
  await expectInsideLeaf(text.createTitle);
  await browser.keys("Escape");
  await projects.waitForDisplayed();
  await browser.keys("Escape");
  await expect(drawer).toBeFocused();

  await writeDataFile({ schemaVersion: 1, aiEnabled: true });
  const copilot = named(root, text.copilot);
  await copilot.click();
  await browser.$(`${root} ${dialog} textarea`).waitForDisplayed();
  await expectInsideLeaf(catalog.integrations.copilot.heading);
  await browser.keys("Escape");
  await expect(copilot).toBeFocused();
  expect(await pluginProblems()).toEqual([]);
});

it("restores project search scroll after Escape and after returning from a result", async () => {
  await browser.execute((scope) => {
    const owner = document.querySelector(scope);
    if (!owner) throw new Error("Expected the project leaf");
    const style = owner.ownerDocument.createElement("style");
    style.textContent = `${scope} [role=dialog] ol { max-height: 68px !important }`;
    owner.append(style);
  }, root);
  const search = named(root, text.search.open);
  const input = browser.$(`${root} ${dialog} input[type=search]`);
  const list = `${root} ${dialog} ol`;
  const scrollPosition = (offset?: number) =>
    browser.execute(
      (selector, top) => {
        const results = document.querySelector<HTMLElement>(selector);
        if (!results) throw new Error("Search results are missing");
        if (typeof top === "number") {
          results.scrollTop = top;
          results.dispatchEvent(new Event("scroll"));
        }
        return { top: results.scrollTop, count: results.querySelectorAll("li").length };
      },
      list,
      offset,
    );

  await search.click();
  await expect(input).toBeFocused();
  await expect(browser.$(list)).toHaveText(expect.stringContaining(catalog.knowledge.title));
  await expect(browser.$(list)).toHaveText(expect.stringContaining(catalog["domain-model"].title));
  const initial = await scrollPosition(45);
  expect(initial.top).toBe(45);
  await browser.keys("Escape");
  await expect(search).toBeFocused();
  await search.click();
  await expect(input).toBeFocused();
  expect(await scrollPosition()).toEqual(initial);

  await browser.keys("ArrowDown");
  expect(await scrollPosition(45)).toEqual(initial);
  await browser.keys("Enter");
  await expect(input).not.toBeDisplayed();
  const back = named(root, catalog.shell.frame.back);
  await back.click();
  await expect(search).toBeFocused();
  await search.click();
  await expect(input).toBeFocused();
  expect(await scrollPosition()).toEqual(initial);
  await browser.keys("Escape");
  expect(await pluginProblems()).toEqual([]);
});
