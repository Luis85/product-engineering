import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { adminProject, customerProject } from "../knowledge-vault";
import {
  adminMapId,
  customerMapId,
  matchedMapTitle,
  seedStoryMapsVault,
} from "../story-maps-vault";
import { openView, ROOT, setTheme, setViewRoute, VIEW_TYPE } from "../support";

const primary = '[data-v13-readability="primary"]';
const sibling = '[data-v13-readability="sibling"]';
const wrappedPbiTitle = "Gefilterte Servicefälle als vollständige CSV-Datei exportieren";
const parts = [
  ["foundations", "Grundlagen", "2"],
  ["prototypes", "Prototypen", "0"],
  ["nfrs", "NFRs", "0"],
  ["entities", "Entitäten", "0"],
] as const;
const backlogLink = `${primary} [data-testid="story-map-card-CARD-03"] [data-story-item="UC-09"]`;

const metrics = (width: number, height: number) =>
  browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

before(async () => {
  await seedStoryMapsVault(wrappedPbiTitle);
  await metrics(1296, 1000);
  await openView();
  await setTheme("light");
  await setViewRoute(storyMapsRoute(customerProject, customerMapId));
  await expect(browser.$(`${ROOT} [data-testid="story-map-detail"] h1`)).toHaveText(
    matchedMapTitle,
  );
  await browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    const pane = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!pane) throw new Error("Missing primary Obsidian leaf");
    pane.dataset.v13Readability = "primary";
  }, VIEW_TYPE);
});

async function sizeLeaf(width: number, height: number, viewport: number) {
  await metrics(viewport, 1000);
  const dimensions = async () =>
    browser.execute(
      (pane: HTMLElement) => {
        const rect = pane.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      },
      await browser.$(primary),
    );
  const initial = await dimensions();
  await metrics(viewport, 1000 + height - initial.height);
  await browser.waitUntil(
    async () => {
      const actual = await dimensions();
      return actual.width === width && actual.height === height;
    },
    { timeout: 7000, timeoutMsg: `Expected an actual ${width}×${height} Obsidian leaf` },
  );
}

async function measureText(
  selector: string,
  partNames: readonly (readonly [string, string, string])[],
) {
  return browser.execute(
    (
      pane: HTMLElement,
      linkSelector: string,
      labels: readonly (readonly [string, string, string])[],
    ) => {
      const owner = pane.ownerDocument;
      const lines = (element: Element) => {
        const roots = owner.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const lineBoxes: DOMRect[] = [];
        for (let node = roots.nextNode(); node; node = roots.nextNode()) {
          if (!node.textContent?.trim()) continue;
          const range = owner.createRange();
          range.selectNodeContents(node);
          lineBoxes.push(
            ...Array.from(range.getClientRects()).filter(
              ({ width, height }) => width > 0 && height > 0,
            ),
          );
        }
        return lineBoxes;
      };
      const contains = (target: DOMRect, glyph: DOMRect) =>
        glyph.left >= target.left - 0.5 &&
        glyph.right <= target.right + 0.5 &&
        glyph.top >= target.top - 0.5 &&
        glyph.bottom <= target.bottom + 0.5;
      const hit = (element: Element, point: DOMRect) =>
        element.contains(
          owner.elementFromPoint(point.x + point.width / 2, point.y + point.height / 2),
        );
      const measure = (button: Element, caption: Element) => {
        const bounds = button.getBoundingClientRect();
        const captionLines = lines(caption);
        return {
          lines: captionLines.length,
          contained: captionLines.every((line) => contains(bounds, line)),
          hit: captionLines.every((line) => hit(button, line)),
        };
      };
      if (linkSelector) {
        const link = pane.querySelector(linkSelector);
        const status = link?.parentElement?.querySelector("small");
        if (!link || !status) throw new Error("The matched backlog link or status is missing");
        const titleLines = lines(link);
        const detailLines = lines(status);
        const bounds = link.getBoundingClientRect();
        return {
          link: {
            text: link.textContent?.replace(/\s+/g, " ").trim(),
            status: status.textContent?.trim(),
            titleBottom: Math.max(...titleLines.map(({ bottom }) => bottom)),
            statusTop: Math.min(...detailLines.map(({ top }) => top)),
            buttonBottom: bounds.bottom,
            ...measure(link, link),
          },
          controls: [],
        };
      }
      const controls = labels.map(([id, display]) => {
        const button = pane.querySelector(`[data-testid="story-map-context-${id}"]`);
        const label = Array.from(button?.children ?? []).find(
          (child) => child.textContent?.trim() === display,
        );
        const count = button?.querySelector(".pe-story-context-count");
        if (!button || !label || !count) throw new Error("A named context control is missing");
        const bounds = button.getBoundingClientRect();
        return {
          name: label.textContent?.trim(),
          count: count.textContent?.trim(),
          labelLayout: measure(button, label),
          countLayout: measure(button, count),
          hit: hit(button, bounds),
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      });
      return { controls, link: undefined };
    },
    await browser.$(primary),
    selector,
    partNames,
  );
}

async function expectContexts() {
  await browser
    .$(`${primary} [data-testid="story-map-context-foundations"]`)
    .scrollIntoView({ block: "center" });
  const { controls } = await measureText("", parts);
  expect(
    controls.map(({ name, count, labelLayout, countLayout, hit }) => ({
      name,
      count,
      labelLayout,
      countLayout,
      hit,
    })),
  ).toEqual(
    parts.map(([, name, count]) => ({
      name,
      count,
      hit: true,
      labelLayout: { lines: 1, contained: true, hit: true },
      countLayout: { lines: 1, contained: true, hit: true },
    })),
  );
  const bounds = await browser.execute(
    (pane: HTMLElement) => ({
      left: pane.getBoundingClientRect().left,
      right: pane.getBoundingClientRect().right,
    }),
    await browser.$(primary),
  );
  const rowTop = controls[0]?.top ?? 0;
  expect(
    controls.every(
      ({ left, right, top, width, height }) =>
        left >= bounds.left &&
        right <= bounds.right &&
        Math.abs(top - rowTop) <= 0.5 &&
        width >= 24 &&
        height >= 24,
    ),
  ).toBe(true);
}

async function expectBacklogLink(minimumLines: number) {
  await browser.$(backlogLink).scrollIntoView({ block: "center" });
  const { link } = await measureText(backlogLink, []);
  if (!link) throw new Error("Missing measured backlog link");
  expect(link).toMatchObject({
    text: `UC-09 · ${wrappedPbiTitle}`,
    status: "PBI · Active",
  });
  expect(link.lines).toBeGreaterThanOrEqual(minimumLines);
  expect({
    ...link,
    separated: link.titleBottom <= link.statusTop + 0.5,
  }).toMatchObject({ contained: true, hit: true, separated: true });
}

it("keeps the three-line canonical backlog link inside its control and above its metadata at 1252×816", async () => {
  await sizeLeaf(1252, 816, 1296);
  await expectContexts();
  await expectBacklogLink(3);
});

it("keeps all four context words and counts whole and hittable in one row in a true 320px split leaf", async () => {
  await metrics(1650, 1000);
  await browser.executeObsidian(
    async ({ app }, type, neighborRoute) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      const pane = leaf?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      const tabs = pane?.closest<HTMLElement>(".workspace-tabs");
      if (!leaf || !pane || !tabs) throw new Error("Missing Obsidian split branch");
      const neighbor = app.workspace.getLeaf("split", "vertical");
      await neighbor.setViewState({ type, active: false, state: { route: neighborRoute } });
      const other = neighbor.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      if (!other) throw new Error("Missing sibling leaf");
      other.dataset.v13Readability = "sibling";
      await app.workspace.revealLeaf(leaf);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      tabs.style.flex = "0 0 320px";
      tabs.style.width = "320px";
      pane.style.flex = "0 0 320px";
      pane.style.width = "320px";
      pane.querySelector<HTMLElement>('[data-testid="project-content"]')?.scrollTo(0, 0);
    },
    VIEW_TYPE,
    storyMapsRoute(adminProject, adminMapId),
  );
  await sizeLeaf(320, 1400, 1650);
  await expect(browser.$(`${sibling} [data-testid="story-map-detail"]`)).toHaveAttribute(
    "data-story-map-id",
    adminMapId,
  );
  await expectContexts();
  await expectBacklogLink(2);
});

it("holds the aligned slice cells and nonzero horizontal map scroll through actions and Escape", async () => {
  await browser.execute(
    (pane: HTMLElement) => {
      const tabs = pane.closest<HTMLElement>(".workspace-tabs");
      if (!tabs) throw new Error("Missing Obsidian split branch");
      for (const target of [pane, tabs]) {
        target.style.flex = "0 0 660px";
        target.style.width = "660px";
      }
    },
    await browser.$(primary),
  );
  await sizeLeaf(660, 760, 1650);
  const edit = browser.$(`${primary} [data-testid="story-map-edit-slice-SL-01"]`);
  await edit.scrollIntoView({ block: "center" });
  const grid = browser.$(`${primary} [data-testid="story-map-scroll"]`);
  await browser.execute(
    (node: HTMLElement) => {
      node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
    },
    await grid,
  );
  const alignment = async () =>
    browser.execute(
      (node: HTMLElement) => ({
        scroll: node.scrollLeft,
        columns: Array.from(node.querySelectorAll('[data-testid^="story-map-cell-SL-01-"]')).map(
          (cell) => {
            const box = cell.getBoundingClientRect();
            return [box.left, box.top, box.width];
          },
        ),
      }),
      await grid,
    );
  const original = await alignment();
  expect(original.scroll).toBeGreaterThan(0);
  expect(original.columns).toHaveLength(4);
  await browser.execute((button: HTMLElement) => button.focus({ preventScroll: true }), await edit);
  await browser.keys("Enter");
  await expect(browser.$(`${primary} [data-testid="story-map-journey-save"]`)).toBeDisplayed();
  expect(await alignment()).toEqual(original);
  await browser.keys("Escape");
  await expect(edit).toBeFocused();
  expect(await alignment()).toEqual(original);
});
