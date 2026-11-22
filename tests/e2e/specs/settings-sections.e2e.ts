import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { appRoutes } from "../../../src/application/routes";
import { itemPath, openItems, texts, writeNote } from "../items";
import {
  installConsoleSpy,
  pluginProblems,
  readVaultText,
  readViewRoute,
  ROOT,
  setViewRoute,
} from "../support";

const section = { name: "settings", section: "data-issues" };
const navigation = `${ROOT} [data-testid='settings-sections']`;
const issues = `${ROOT} [data-testid='data-issues-list']`;

function dataIssueButton() {
  return browser.$(navigation).$(`button*=${texts.notes.unindexed.label}`);
}

it("navigates settings sections accessibly, persists the selection, and fits 320 px", async () => {
  await installConsoleSpy();
  const unreadable = itemPath("A note with unreadable frontmatter");
  await writeNote(unreadable, "---\nstatus: [\n---\n");
  await openItems();
  const nav = browser.$(navigation);
  expect(await nav.$$("button")).toHaveLength(2);
  await expect(nav.$(`button=${texts.items.settings.label}`)).toHaveAttribute(
    "aria-current",
    "page",
  );
  const button = dataIssueButton();
  await expect(button.$("[data-testid='data-issues-badge']")).toHaveText("1");
  await button.click();
  await browser.$(issues).waitForDisplayed();
  expect(await readViewRoute()).toEqual(section);
  expect(
    await browser.execute(
      (selector) =>
        document.activeElement === document.querySelector(selector + " [aria-current='page']"),
      navigation,
    ),
  ).toBe(true);

  const sizing = await browser.execute((selector) => {
    const surface = document.querySelector<HTMLElement>(selector);
    if (!surface) throw new Error("The routed surface is missing");
    surface.style.width = "320px";
    surface.style.maxWidth = "320px";
    return { width: surface.clientWidth, scroll: surface.scrollWidth };
  }, ROOT);
  expect(sizing.width).toBe(320);
  expect(sizing.scroll).toBeLessThanOrEqual(321);

  const back = `${ROOT} [data-testid='frame-history'] button[aria-label=${JSON.stringify(texts.shell.frame.back)}]`;
  await browser.$(back).click();
  expect(await readViewRoute()).toEqual(appRoutes.start);
  await dataIssueButton().click();
  await browser.waitUntil(
    async () => {
      const layout = await readVaultText(".obsidian/workspace.json");
      if (layout === null) return false;
      try {
        return JSON.stringify(JSON.parse(layout)).includes('"section":"data-issues"');
      } catch {
        return false;
      }
    },
    { timeoutMsg: "The native view did not save the selected section" },
  );
  expect(await pluginProblems()).toEqual([]);

  await browser.reloadObsidian();
  await installConsoleSpy();
  await browser.$(issues).waitForDisplayed();
  expect(await readViewRoute()).toEqual(section);
  await setViewRoute({ name: "settings", section: "no-longer-registered" });
  await browser.$(`${ROOT} [data-testid='items-screen']`).waitForDisplayed();
  expect(await readViewRoute()).toEqual(appRoutes.start);
  expect(await pluginProblems()).toEqual([]);
});
