import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { reviewTestedCommit } from "../review-register-vault";
import { customerMapId } from "../story-maps-vault";
import { installConsoleSpy, pluginProblems, readViewRoute, ROOT, setTheme } from "../support";
import { seedComparisonTrace, traceResearch } from "../trace-vault";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

async function expectDropdownCue(select: WebdriverIO.Element) {
  const cue = await browser.execute((control: HTMLElement) => {
    const icon = control.nextElementSibling;
    const shape = icon?.querySelector("[stroke='currentColor']");
    const view = control.ownerDocument.defaultView;
    if (!icon || !shape || !view) return { chevron: false };
    const bounds = icon.getBoundingClientRect();
    const field = control.getBoundingClientRect();
    const iconStyle = view.getComputedStyle(icon);
    const fieldStyle = view.getComputedStyle(control);
    return {
      chevron: icon.tagName.toLowerCase() === "svg",
      ariaHidden: icon.getAttribute("aria-hidden"),
      visibility: iconStyle.visibility,
      opacity: iconStyle.opacity,
      pointerEvents: iconStyle.pointerEvents,
      themedStroke: view.getComputedStyle(shape).stroke === fieldStyle.color,
      width: bounds.width,
      height: bounds.height,
      inEndPadding:
        bounds.left >= field.right - Number.parseFloat(fieldStyle.paddingInlineEnd) &&
        bounds.right < field.right,
      centerOffset: Math.abs((bounds.top + bounds.bottom - field.top - field.bottom) / 2),
    };
  }, select);
  expect(cue).toMatchObject({
    chevron: true,
    ariaHidden: "true",
    visibility: "visible",
    opacity: "1",
    pointerEvents: "none",
    themedStroke: true,
    inEndPadding: true,
  });
  expect(cue.width).toBeGreaterThanOrEqual(12);
  expect(cue.height).toBeGreaterThanOrEqual(12);
  expect(cue.centerOffset).toBeLessThanOrEqual(1);
}

it("V21: follows UC-09 from JOB-12 and PRD-03#REQ-18 to exact card and FR-024 revision 2, then isolates UC-12", async function () {
  this.timeout(90_000);
  const { sourceCommit } = await seedComparisonTrace();
  await installConsoleSpy();
  await setTheme("light");
  const rail = el("project-rail").$("button=Nachweiskette");
  await expect(rail).toBeDisplayed();
  await rail.click();
  const select = () => el("trace-pbi");
  await expect(select()).toBeDisplayed();
  await expect(select()).toHaveValue("UC-09");
  await expectDropdownCue(await select());
  const source = () => el("trace-source");
  await expect(source()).toHaveText(expect.stringContaining(traceResearch));
  await expect(source()).toHaveText(expect.stringContaining(sourceCommit));
  await expect(source()).toHaveText(expect.stringContaining("JOB-12"));
  await expect(source()).toHaveText(expect.stringContaining("VIS-01"));
  await expect(source()).toHaveText(expect.stringContaining("PRD-03#REQ-18"));
  const delivery = () => el("trace-delivery");
  for (const value of ["FR-024", "Revision 2", "#47", reviewTestedCommit]) {
    await expect(delivery()).toHaveText(expect.stringContaining(value));
  }
  await expect(delivery()).not.toHaveText(expect.stringContaining(sourceCommit));
  await expect(
    el("trace-criteria").$("[data-trace-criterion=AC-01][data-trace-scenario=SC-091]"),
  ).toHaveText(expect.stringContaining("ci-42"));
  await expect(
    el("trace-criteria").$("[data-trace-criterion=AC-02][data-trace-scenario=SC-092]"),
  ).toHaveText(expect.stringContaining("ci-43"));
  await el("trace-source-requirement").click();
  await expect(el("project-record-return")).toBeDisplayed();
  await el("project-record-return").click();
  await expect(el("trace-source-requirement")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-source-requirement")).toBeFocused();
  const card = () => source().$("[data-trace-card='CARD-03']");
  await expect(card()).toHaveText(expect.stringContaining("SM-01:CARD-03"));
  await browser.execute((node: HTMLElement) => node.focus(), await card());
  await browser.keys("Enter");
  await expect(el("story-map-card-CARD-03")).toBeDisplayed();
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId, "CARD-03"));
  await expect(el("story-map-card-CARD-03").$("[data-story-node=CARD-03]")).toBeFocused();
  await el("frame-history").$("button:first-child").click();
  await expect(card()).toBeDisplayed({ wait: 20_000 });
  await expect(card()).toBeFocused();
  await narrowKnowledgeLeaf();
  const geometry = await browser.execute(
    (workspace: HTMLElement) => {
      const sourceBox = workspace
        .querySelector('[data-testid="trace-source"]')
        ?.getBoundingClientRect();
      const deliveryBox = workspace
        .querySelector('[data-testid="trace-delivery"]')
        ?.getBoundingClientRect();
      return {
        overflow: workspace.scrollWidth - workspace.clientWidth,
        stacked: Boolean(sourceBox && deliveryBox && sourceBox.bottom <= deliveryBox.top),
      };
    },
    await el("trace-workspace"),
  );
  expect(geometry.stacked).toBe(true);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  await expectDropdownCue(await select());
  await setTheme("dark");
  await expectDropdownCue(await select());
  await browser.sendCommandAndGetResult("Emulation.setEmulatedMedia", {
    features: [{ name: "forced-colors", value: "active" }],
  });
  try {
    expect(await browser.execute(() => window.matchMedia("(forced-colors: active)").matches)).toBe(
      true,
    );
    await expectDropdownCue(await select());
  } finally {
    await browser.sendCommandAndGetResult("Emulation.setEmulatedMedia", { features: [] });
  }
  await browser.execute((node: HTMLElement) => node.focus(), await select());
  await browser.keys("ArrowDown");
  await expect(select()).toHaveValue("UC-14");
  await browser.keys("ArrowDown");
  await expect(select()).toHaveValue("UC-12");
  await expect(select()).toBeFocused();
  await expect(source().$("[data-trace-card='CARD-04']")).toBeDisplayed();
  await expect(source()).not.toHaveText(expect.stringContaining("VIS-01"));
  await expect(source()).not.toHaveText(expect.stringContaining(traceResearch));
  await expect(delivery()).not.toHaveText(expect.stringContaining("FR-024"));
  expect(await pluginProblems()).toEqual([]);
});
