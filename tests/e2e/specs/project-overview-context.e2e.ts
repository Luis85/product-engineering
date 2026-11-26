import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { projectOverviewRoute } from "../../../src/application/projects";
import { storyMapSliceRoute, storyMapsRoute } from "../../../src/application/story-maps";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { adminProject, customerProject, jobTwo } from "../knowledge-vault";
import {
  alternateMapId,
  alternateMapTitle,
  alternatePrd,
  alternateSlice,
  alternateVision,
  populateAlternateSlice,
  seedOverviewContexts,
} from "../overview-vault";
import { adminMapId, customerMapId, matchedPrdTitle } from "../story-maps-vault";
import { openView, readVaultText, readViewRoute, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const planning = () => el("project-overview-planning");
const select = () => el("overview-context");
const step = (name: string) => planning().$(`[data-overview-step="${name}"]`);
const back = () => el("frame-history").$('button[aria-label="Zurück"]');
const modal = () => browser.$(`${ROOT} [role=dialog][data-state=open]`);

async function switchProject(name: string) {
  await el("project-rail").$('button[aria-label="Projekt wechseln oder anlegen"]').click();
  await modal().$(`button[aria-label="${name}"]`).click();
  await expect(el("project-workspace").$("h1")).toHaveText(name);
}

async function expectVisiblePlanningCue() {
  const facts = await browser.execute(
    (control: HTMLElement) => {
      const icon = control.nextElementSibling;
      const stroke = icon?.querySelector("[stroke='currentColor']");
      if (!(icon instanceof SVGSVGElement) || !stroke) return { visibleChevron: false };
      const glyph = icon.getBoundingClientRect();
      const field = control.getBoundingClientRect();
      const fieldStyle = getComputedStyle(control);
      const style = getComputedStyle(icon);
      return {
        visibleChevron:
          style.visibility === "visible" &&
          style.opacity === "1" &&
          glyph.width === 16 &&
          glyph.height === 16,
        centered: Math.abs((glyph.top + glyph.bottom - field.top - field.bottom) / 2) <= 1,
        insideEndPadding:
          glyph.left >= field.right - Number.parseFloat(fieldStyle.paddingInlineEnd) &&
          glyph.right < field.right,
        themedStroke: getComputedStyle(stroke).stroke === fieldStyle.color,
        pointerEvents: style.pointerEvents,
        ariaHidden: icon.getAttribute("aria-hidden"),
      };
    },
    await select(),
  );
  expect(facts).toEqual({
    visibleChevron: true,
    centered: true,
    insideEndPadding: true,
    themedStroke: true,
    pointerEvents: "none",
    ariaHidden: "true",
  });
}

it("J10: keeps competing solutions and an advancing Job in their own project planning contexts", async function () {
  this.timeout(130_000);
  await seedOverviewContexts();
  await setTheme("light");
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setViewRoute(projectOverviewRoute(customerProject));
  await expect(select()).toBeDisplayed();
  await expect(select()).toHaveValue(customerMapId);
  await expectVisiblePlanningCue();
  await expect(step("prd")).toHaveText(expect.stringContaining(matchedPrdTitle));
  await expect(step("vision")).toHaveText(expect.stringContaining("Durchgängiger Kundenservice"));
  await expect(step("job")).toHaveText(expect.stringContaining("JOB-12"));
  await expect(step("handoff")).toHaveText(
    expect.stringContaining("2 von 3 Stories zugeordnet oder zurückgestellt"),
  );
  await expect(step("handoff").$$('[data-testid="overview-slice-pbi"]')).toBeElementsArrayOfSize(2);
  const inspect = step("handoff").$("button=Stories fürs Backlog prüfen");
  await browser.execute((control: HTMLElement) => control.focus(), await inspect);
  await browser.keys("Enter");
  await expect(el("slice-review").$("h1")).toHaveText("Erster nutzbarer Ablauf");
  expect(await readViewRoute()).toEqual(
    storyMapSliceRoute(customerProject, customerMapId, "SL-01"),
  );
  await back().click();
  await expect(inspect).toBeFocused();

  await select().selectByAttribute("value", alternateMapId);
  await expect(step("job")).toHaveText(expect.stringContaining("JOB-12"));
  await expect(step("prd")).toHaveText(expect.stringContaining(alternatePrd));
  await expect(step("vision")).toHaveText(expect.stringContaining(alternateVision));
  await expect(step("map")).toHaveText(expect.stringContaining(alternateMapTitle));
  await expect(step("slice")).toHaveText(expect.stringContaining(alternateSlice));
  await step("slice").$("button=Stories einplanen").click();
  await expect(el("story-map-detail").$("h1")).toHaveText(alternateMapTitle);
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, alternateMapId));
  await back().click();
  await expect(select()).toHaveValue(alternateMapId);
  await populateAlternateSlice();
  await expect(step("handoff")).toHaveText(
    expect.stringContaining("1 von 2 Stories zugeordnet oder zurückgestellt"),
  );
  await expect(step("handoff").$('[data-testid="overview-slice-pbi"]')).toHaveText(
    expect.stringContaining("UC-12"),
  );
  await expect(step("handoff").$("button=Stories fürs Backlog prüfen")).toBeDisplayed();

  await select().selectByAttribute("value", jobTwo);
  await expect(step("job")).toHaveText(expect.stringContaining("JOB-19"));
  await expect(step("prd").$("button=PRD ausarbeiten")).toBeDisplayed();
  await switchProject("Admin Console");
  await expect(step("map")).toHaveText(expect.stringContaining("Zugriff einer Vertretung planen"));
  await expect(step("job")).toHaveText(expect.stringContaining("Vertretung berechtigen"));
  await expect(step("vision")).toHaveText(
    expect.stringContaining("Vertretung in der Administration absichern"),
  );
  await expect(step("slice")).toHaveText(expect.stringContaining("Erste Stellvertretung"));
  await expect(step("handoff")).toHaveText(
    expect.stringContaining("1 von 1 Story zugeordnet oder zurückgestellt"),
  );
  await step("map").$("button*=Zugriff einer Vertretung planen").click();
  await expect(el("story-map-detail").$("h1")).toHaveText("Zugriff einer Vertretung planen");
  expect(await readViewRoute()).toEqual(storyMapsRoute(adminProject, adminMapId));
  await back().click();
  await switchProject("Kundenportal");
  await expect(select()).toHaveValue(jobTwo);
  await step("prd").$("button=PRD ausarbeiten").click();
  await expect(modal().$(`input[value="${jobTwo}"]`)).toBeSelected();
  await expect(modal().$('[name="vision_id"]')).toHaveValue(
    "knowledge-33333333-3333-4333-8333-000000000007",
  );
  await modal().$('[name="title"]').setValue("Nachvollziehbare Freigaben");
  await modal().$('button[type="submit"]').click();
  await expect(el("knowledge-note").$("h1")).toHaveText("Nachvollziehbare Freigaben");
  await el("project-record-return").click();
  await expect(step("prd")).toHaveText(expect.stringContaining("Nachvollziehbare Freigaben"));
  await expect(step("job")).toHaveText(expect.stringContaining("JOB-19"));
  await step("map").$("button=Story Map erstellen").click();
  await expect(modal().$('[name="title"]')).toHaveValue("Nachvollziehbare Freigaben");
  await modal().$('[name="title"]').setValue("Freigabeschritte im Service");
  await modal().$('[name="goal"]').setValue("Partner können Freigaben nachvollziehen.");
  await el("story-map-submit").click();
  await expect(el("story-map-detail").$("h1")).toHaveText("Freigabeschritte im Service");
  await back().click();
  await expect(step("map")).toHaveText(expect.stringContaining("Freigabeschritte im Service"));
  await expect(step("slice").$("button=Lieferabschnitt planen")).toBeDisplayed();
  const selected = await select().getValue();
  expect(selected).not.toBe(customerMapId);
  await browser.waitUntil(async () =>
    Boolean((await readVaultText(".obsidian/workspace.json"))?.includes(selected)),
  );
  await browser.reloadObsidian();
  await openView();
  await expect(select()).toHaveValue(selected);
  await expect(step("map")).toHaveText(expect.stringContaining("Freigabeschritte im Service"));
  await narrowKnowledgeLeaf();
  await expectVisiblePlanningCue();
  await setTheme("dark");
  await expectVisiblePlanningCue();
});
