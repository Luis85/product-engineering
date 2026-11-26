import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { prototypesRoute } from "../../../src/application/prototypes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { legacyPrototypeId, seedPrototypesVault } from "../prototype-vault";
import { openView, ROOT, setTheme, setViewRoute } from "../support";

const preview = () => browser.$(`${ROOT} [data-testid=prototype-preview]`);
const metrics = (width: number, height: number) =>
  browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

async function measure() {
  return browser.execute(
    (node: HTMLElement) => {
      const leaf = node.closest(".workspace-leaf")?.getBoundingClientRect();
      if (!leaf) throw new Error("Installed preview has no owning leaf");
      const iframe = node.getBoundingClientRect();
      return {
        width: Math.round(leaf.width),
        height: Math.round(leaf.height),
        top: Math.round(iframe.top - leaf.top),
        visibleHeight: Math.round(Math.min(leaf.bottom, iframe.bottom) - iframe.top),
      };
    },
    await preview(),
  );
}

async function sample(width: number, viewport: number) {
  await metrics(viewport, 940);
  const initial = await measure();
  await metrics(viewport + width - initial.width, 940 + 900 - initial.height);
  await browser.waitUntil(async () => {
    const view = await measure();
    return view.width === width && view.height === 900;
  });
  const view = await measure();
  await browser.switchFrame(await preview());
  try {
    const controls = await browser.execute(() => {
      const bottom = (selector: string) =>
        Math.round(document.querySelector(selector)?.getBoundingClientRect().bottom ?? -1);
      return {
        filter: bottom("#status"),
        csv: bottom("#export"),
        firstRow: bottom("tbody tr:first-child"),
        scrollY: window.scrollY,
      };
    });
    return { ...view, ...controls };
  } finally {
    await browser.switchFrame(null);
  }
}

it("keeps the legacy filter, CSV action and first case in view at normal and narrow top scroll", async () => {
  await seedPrototypesVault();
  await openView();
  await setTheme("light");
  await setViewRoute(prototypesRoute(customerProject, legacyPrototypeId));
  await expect(preview()).toBeDisplayed();
  const normal = await sample(1440, 1484);
  await narrowKnowledgeLeaf();
  const narrow = await sample(390, 1740);
  process.stdout.write(`V16 top-scroll legacy visibility ${JSON.stringify({ normal, narrow })}\n`);
  for (const view of [normal, narrow]) {
    expect(view.scrollY).toBe(0);
    expect(view.filter).toBeGreaterThan(0);
    expect(view.csv).toBeGreaterThan(0);
    expect(view.firstRow).toBeGreaterThan(0);
    expect(view.visibleHeight).toBeGreaterThanOrEqual(
      Math.max(view.filter, view.csv, view.firstRow),
    );
  }
});
