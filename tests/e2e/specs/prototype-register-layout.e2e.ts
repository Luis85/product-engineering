import { resolve } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { prototypesRoute } from "../../../src/application/prototypes";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { legacyPrototypeTitle, seedPrototypesVault } from "../prototype-vault";
import { openView, ROOT, setTheme, setViewRoute } from "../support";

const register = () => browser.$(`${ROOT} [data-testid=prototype-register]`);
const legacy = () => register().$("[data-prototype-row=PT-03]");
const metrics = (width: number, height: number) =>
  browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

before(async () => {
  await seedPrototypesVault();
  await openView();
  await setViewRoute(prototypesRoute(customerProject));
  await expect(legacy()).toHaveText(expect.stringContaining("Gefilterte Servicefälle exportieren"));
});

async function geometry() {
  return browser.execute(
    (node: HTMLElement) => {
      const leaf = node.closest(".workspace-leaf");
      const row = node.querySelector<HTMLElement>('[data-prototype-row="PT-03"]');
      if (!leaf || !row) throw new Error("Expected an installed prototype register");
      const leafRect = leaf.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const within = (inner: DOMRect, outer: DOMRect) =>
        inner.left >= outer.left - 1 &&
        inner.right <= outer.right + 1 &&
        inner.top >= outer.top - 1 &&
        inner.bottom <= outer.bottom + 1;
      const docs = [
        ...row.querySelectorAll<HTMLElement>(
          "button, .pe-prototype-status, .pe-prototype-mobile-label, td:first-child .pe\\:text-xs",
        ),
      ].flatMap((element) => {
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        const rects = Array.from(range.getClientRects()).filter(
          ({ width, height }) => width > 0 && height > 0,
        );
        if (!rects.length) return [];
        return [
          {
            label: element.textContent?.trim(),
            fits: rects.every((box) => within(box, rowRect) && within(box, leafRect)),
            lines: rects.length,
          },
        ];
      });
      return {
        width: Math.round(leafRect.width),
        height: Math.round(leafRect.height),
        overflow: node.scrollWidth - node.clientWidth,
        docs,
      };
    },
    await register(),
  );
}

async function sample(width: number, viewportWidth: number) {
  await metrics(viewportWidth, 940);
  const initial = await geometry();
  await metrics(viewportWidth + width - initial.width, 940 + 900 - initial.height);
  await browser.waitUntil(
    async () => {
      const size = await geometry();
      return size.width === width && size.height === 900;
    },
    { timeoutMsg: `Expected ${width} × 900 native leaf` },
  );
  const measured = await geometry();
  process.stdout.write(`V15 native register ${JSON.stringify(measured)}\n`);
  expect(measured.overflow).toBe(0);
  expect(measured.docs.every(({ fits }) => fits)).toBe(true);
  const labels = measured.docs.map(({ label }) => label);
  for (const label of [
    legacyPrototypeTitle,
    "PT-03 · Revision 2",
    "Gefilterte Servicefälle exportieren",
    "Klickbar",
  ])
    expect(labels).toContain(label);
  if (width === 390) expect(labels).toEqual(expect.arrayContaining(["Umfang", "Stand"]));
  if (process.env.V15_CAPTURE_LAYOUT)
    await browser.saveScreenshot(resolve(`reports/product-views/V15-native-${width}.png`));
}

it("keeps the matched PT-03 scope, status and revision attached in a 1440px leaf and 390px split", async () => {
  await setTheme("light");
  await sample(1440, 1484);
  await narrowKnowledgeLeaf();
  await setTheme("dark");
  await sample(390, 1740);
  const control = legacy().$(`button=${legacyPrototypeTitle}`);
  await browser.execute((element: HTMLElement) => element.focus(), await control);
  await browser.keys("Enter");
  await expect(browser.$(`${ROOT} [data-testid=prototype-detail] h1`)).toHaveText(
    legacyPrototypeTitle,
  );
});
