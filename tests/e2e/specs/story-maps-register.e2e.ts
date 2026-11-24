import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { adminProject, customerProject } from "../knowledge-vault";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import {
  adminMapId,
  customerMapId,
  matchedMapGoal,
  matchedMapLinks,
  matchedMapPath,
  matchedMapPersona,
  matchedMapTitle,
  matchedPrdTitle,
  seedStoryMapsVault,
} from "../story-maps-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  ROOT,
  setTheme,
  setViewRoute,
  TEST_LANGUAGE,
  writeVaultText,
} from "../support";

const text = catalogFor(TEST_LANGUAGE);
const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const named = (scope: string, label: string) =>
  browser.$(`${scope} button[aria-label=${JSON.stringify(label)}]`);
const row = () => el("story-map-row");
const mapNav = () => named(`${ROOT} [data-testid="project-rail"]`, text["story-maps"].title);
const picker = () => named(`${ROOT} [data-testid="project-rail"]`, text.projects.picker);
const goBack = () => named(`${ROOT} [data-testid="frame-history"]`, text.shell.frame.back);
const counts = "SM-01 · 5 Storys · 4 mit Backlog-Link";

before(seedStoryMapsVault);

async function keyboardActivate(button: WebdriverIO.Element) {
  await browser.execute((control: HTMLElement) => control.focus(), button);
  await browser.keys("Enter");
}

it("opens the matched Kundenportal map from Planning and isolates the second project's SM-01", async () => {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 860,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setTheme("light");
  await browser.$(ROOT).$("button=Kundenportal").click();
  await mapNav().click();
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject));
  await expect(el("story-map-row-title")).toHaveText(matchedMapTitle);
  await expect(row()).toHaveText(expect.stringContaining(matchedMapGoal));
  await expect(row()).toHaveText(expect.stringContaining(matchedMapPersona));
  await expect(el("story-map-row-counts")).toHaveText(counts);
  await expect(el("story-map-create")).toHaveText("Story Map erstellen");
  await keyboardActivate(await row());
  await expect(el("story-map-detail").$("h1")).toHaveText(matchedMapTitle);
  await el("story-map-context-foundations").click();
  await expect(el("story-map-source-prd")).toHaveText(`PRD-03 · ${matchedPrdTitle}`);
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId));
  await keyboardActivate(await goBack());
  await expect(row()).toBeFocused();

  await picker().click();
  await named(`${ROOT} [role=dialog]`, "Admin Console").click();
  await mapNav().click();
  await expect(el("story-map-row-title")).toHaveText("Zugriff einer Vertretung planen");
  await expect(el("story-map-row-counts")).toHaveText("SM-01 · 0 Storys · 0 mit Backlog-Link");
  await row().click();
  await expect(el("story-map-detail")).toHaveAttribute("data-story-map-id", adminMapId);
  await setViewRoute(storyMapsRoute(adminProject, customerMapId));
  await expect(el("story-maps")).toHaveText(expect.stringContaining(text["story-maps"].missing));
});

it("round-trips the flat typed card_links field through the native NoteStore and updates live counts", async () => {
  await setViewRoute(storyMapsRoute(customerProject));
  await expect(el("story-map-row-counts")).toHaveText(counts);
  const withoutFeature = matchedMapLinks.filter(({ recordId }) => recordId !== "FE-01");
  const changeLinks = (links: typeof matchedMapLinks) =>
    browser.executeObsidian(
      ({ plugins }, path, cardLinks) =>
        plugins.noteStoreProbe.api.update(path, { set: { card_links: cardLinks } }),
      matchedMapPath,
      links,
    );
  expect(await changeLinks(withoutFeature)).toMatchObject({ success: true });
  await expect(el("story-map-row-counts")).toHaveText("SM-01 · 5 Storys · 3 mit Backlog-Link");
  expect(
    await browser.executeObsidian(
      ({ plugins }, path) => plugins.noteStoreProbe.api.read(path),
      matchedMapPath,
    ),
  ).toMatchObject({
    success: true,
    value: { frontmatter: { id: customerMapId, card_links: withoutFeature } },
  });
  expect(await changeLinks(matchedMapLinks)).toMatchObject({ success: true });
  await expect(el("story-map-row-counts")).toHaveText(counts);
  const raw = await readVaultText(matchedMapPath);
  expect(raw).toContain("card_links:");
  expect(raw).toContain("recordId: FE-01");
});

it("reconciles an outside edit and shows readable title and counts in a short narrow leaf", async function () {
  this.timeout(120_000);
  await setViewRoute(storyMapsRoute(customerProject));
  await expect(el("story-map-row-counts")).toHaveText(counts);
  const original = await readVaultText(matchedMapPath);
  if (!original) throw new Error("Fixture map is missing");
  const longTitle =
    "Verlässlich übergebene Servicefälle mit organisationsübergreifender Vertretung und nachvollziehbaren Zuständigkeiten";
  const edited = original
    .replace(matchedMapTitle, longTitle)
    .replace(/^(schema: .+)$/m, "$1\npartner_note: preserve # outside contribution");
  await writeVaultText(matchedMapPath, edited);
  await expect(el("story-map-row-title")).toHaveText(longTitle);
  await setTheme("dark");
  await narrowKnowledgeLeaf();
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 440,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const layout = await browser.execute(
    (button: HTMLElement) => {
      const title = button
        .querySelector('[data-testid="story-map-row-title"]')
        ?.getBoundingClientRect();
      const totals = button
        .querySelector('[data-testid="story-map-row-counts"]')
        ?.getBoundingClientRect();
      const leaf = button.closest(".workspace-leaf")?.getBoundingClientRect();
      return {
        leafWidth: leaf?.width ?? 0,
        titleWidth: title?.width ?? 0,
        countsBelowTitle: Boolean(totals && title && totals.top >= title.bottom),
        noOverflow: button.scrollWidth <= button.clientWidth + 1,
      };
    },
    await row(),
  );
  expect(layout.leafWidth).toBeGreaterThanOrEqual(380);
  expect(layout.leafWidth).toBeLessThanOrEqual(400);
  expect(layout.titleWidth).toBeGreaterThan(245);
  expect(layout.countsBelowTitle).toBe(true);
  expect(layout.noOverflow).toBe(true);
  await expect(el("story-map-row-counts")).toHaveText(counts);
  await keyboardActivate(await el("story-map-create"));
  const title = browser.$(`${ROOT} [role=dialog] [name=title]`);
  const submit = el("story-map-submit");
  await expect(title).toBeFocused();
  await browser.keys("Tab");
  await expect(browser.$(`${ROOT} [role=dialog] [name=persona]`)).toBeFocused();
  await browser.keys("Tab");
  await expect(browser.$(`${ROOT} [role=dialog] [name=goal]`)).toBeFocused();
  await browser.keys("Tab");
  await expect(el("story-map-cancel")).toBeFocused();
  await browser.keys("Tab");
  await expect(submit).toBeFocused();
  const reachable = await browser.execute(
    (control: HTMLElement) => {
      const bounds = control.getBoundingClientRect();
      return (
        bounds.height > 0 &&
        bounds.top >= 0 &&
        bounds.bottom <= (control.ownerDocument.defaultView?.innerHeight ?? 0)
      );
    },
    await submit,
  );
  expect(reachable).toBe(true);
  await browser.keys("Escape");
  await expect(el("story-map-create")).toBeFocused();
  await keyboardActivate(await row());
  await expect(el("story-map-detail").$("h1")).toHaveText(longTitle);
  await browser.waitUntil(async () => {
    const workspace = await readVaultText(".obsidian/workspace.json");
    return workspace?.includes(customerMapId) ?? false;
  });
  await browser.reloadObsidian();
  await expect(el("story-map-detail").$("h1")).toHaveText(longTitle);
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId));
  expect(await readVaultText(matchedMapPath)).toBe(edited);
});
