import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { measureAppearance, saveAppearanceReport } from "../appearance";
import {
  fixtureId,
  fixtureItem,
  itemCard,
  itemForm,
  itemPath,
  openEdit,
  openItems,
  writeNote,
} from "../items";
import { installConsoleSpy, pluginProblems, ROOT, setTheme, VIEW_TYPE } from "../support";

const title = "W".repeat(100);
const id = fixtureId(23);

async function measurements(theme: "light" | "dark") {
  await setTheme(theme);
  await browser.$(ROOT + "." + theme).waitForDisplayed();
  const overview = await measureAppearance(ROOT + "." + theme);
  await openEdit(id);
  const dialog = `${ROOT} [role='dialog']`;
  await browser.execute((selector) => {
    document.querySelector<HTMLElement>(selector + " button[type='button']")?.focus();
  }, dialog);
  const form = await measureAppearance(dialog);
  await browser.keys("Escape");
  await itemForm().waitForDisplayed({ reverse: true });
  return { overview, form };
}

function undersized(report: Awaited<ReturnType<typeof measurements>>) {
  return [
    ...[...report.overview.text, ...report.form.text].filter(({ ratio }) => ratio < 4.5),
    ...report.form.fields.filter(({ ratio }) => ratio < 3),
  ];
}

async function verifyChrome(): Promise<void> {
  const style = await browser.execute((selector) => {
    const surface = document.querySelector(selector);
    const item = surface?.querySelector("[data-testid='items-screen']");
    const headings = Array.from(item?.querySelectorAll("h1, h2, h3, p, ul") ?? []);
    const section = surface?.querySelector("[data-testid='settings-sections']");
    const active = section?.querySelector("button[aria-current='page']");
    const ghost = section?.querySelector("button:not([aria-current])");
    if (!active || !ghost || headings.length === 0)
      throw new Error("Appearance controls are missing");
    const separator = getComputedStyle(active, "::after");
    const ghostStyle = getComputedStyle(ghost);
    return {
      reset: headings.every((element) => {
        const css = getComputedStyle(element);
        return css.marginTop === "0px" && css.marginBottom === "0px";
      }),
      titleBar: Number.parseFloat(separator.height),
      ghostBackground: ghostStyle.backgroundColor,
      ghostShadow: ghostStyle.boxShadow,
    };
  }, ROOT);
  expect(style.reset).toBe(true);
  expect(style.titleBar).toBeGreaterThan(0);
  expect(style.ghostBackground).toBe("rgba(0, 0, 0, 0)");
  expect(style.ghostShadow).toBe("none");
}

async function verifySidebar(): Promise<void> {
  const sidebar = "[data-e2e='appearance-sidebar'] " + ROOT;
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getRightLeaf(false);
    if (!leaf) throw new Error("A right sidebar leaf is unavailable");
    await leaf.setViewState({
      type,
      active: true,
      state: { route: { name: "settings", section: "items" } },
    });
    leaf.view.containerEl.dataset.e2e = "appearance-sidebar";
    await app.workspace.revealLeaf(leaf);
  }, VIEW_TYPE);
  await browser.$(sidebar + " [data-focus='name']").waitForDisplayed();
  const sizes = await browser.execute((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    const heading = root?.querySelector("[data-focus='name']");
    if (!root || !heading) throw new Error("The sidebar card is missing");
    const span = document.createRange();
    span.selectNodeContents(heading);
    const first = { visible: root.clientWidth, scroll: root.scrollWidth };
    root.style.width = "320px";
    root.style.maxWidth = "320px";
    const lines = new Set(Array.from(span.getClientRects(), ({ y }) => y));
    return { first, narrow: root.clientWidth, scroll: root.scrollWidth, lines: lines.size };
  }, sidebar);
  expect(sizes.first.scroll).toBeLessThanOrEqual(sizes.first.visible + 1);
  expect(sizes.narrow).toBe(320);
  expect(sizes.scroll).toBeLessThanOrEqual(321);
  expect(sizes.lines).toBeGreaterThan(1);
}

it("measures default-theme contrast and keeps the Items layout readable in the sidebar", async () => {
  await installConsoleSpy();
  await writeNote(itemPath("A long title"), fixtureItem(id, title));
  await openItems();
  await itemCard(id).waitForDisplayed();
  await verifyChrome();
  const light = await measurements("light");
  const dark = await measurements("dark");
  await saveAppearanceReport({ light, dark });
  expect(light.overview.text.length).toBeGreaterThan(0);
  expect(dark.form.fields.length).toBeGreaterThan(0);
  expect(undersized(light)).toEqual([]);
  expect(undersized(dark)).toEqual([]);
  await verifySidebar();
  expect(await pluginProblems()).toEqual([]);
});
