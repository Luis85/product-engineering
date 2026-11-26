import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { domainModelRoute } from "../../../src/application/domain-model";
import { customerProject } from "../knowledge-vault";
import { organisation, organisationPath, seedDomainModelVault } from "../domain-model-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute, VIEW_TYPE } from "../support";

const item = (id: string) => browser.$(`${ROOT} [data-testid=${id}]`);
const canvas = () => item("domain-viewport");
const entity = () => canvas().$(`[data-domain-node="${organisation}"]`);
const arrowRight = "\uE014";

before(() => seedDomainModelVault(true));

async function geometry() {
  return browser.execute(
    (root, id) => {
      const viewport = document.querySelector<HTMLElement>(root + " [data-testid=domain-viewport]");
      const world = viewport?.querySelector<HTMLElement>("[data-domain-world]");
      const node = world?.querySelector<HTMLButtonElement>(`[data-domain-node="${id}"]`);
      const owner = viewport?.closest<HTMLElement>(".workspace-leaf");
      const project = viewport?.closest<HTMLElement>("[data-testid=project-content]");
      const frame = viewport?.closest<HTMLElement>("[data-testid=app-frame]");
      if (!viewport || !world || !owner || !node || !project || !frame)
        throw new Error("Missing real diagram geometry");
      const packed = (element: HTMLElement) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        view: packed(viewport),
        world: packed(world),
        node: packed(node),
        zoom: Number(world.dataset.zoom),
        ownerWidth: owner.getBoundingClientRect().width,
        modelX: Number.parseFloat(node.style.left),
        pageOverflow: Math.max(
          ...[owner, project, frame].map((element) => element.scrollWidth - element.clientWidth),
        ),
      };
    },
    ROOT,
    organisation,
  );
}

async function setOwnerWidth(value: number) {
  await browser.executeObsidian(
    ({ app }, type, target) => {
      const pane = app.workspace
        .getLeavesOfType(type)[0]
        ?.view.containerEl.closest<HTMLElement>(".workspace-leaf");
      if (!pane) throw new Error("Missing the installed split leaf");
      pane.style.flex = `0 0 ${target}px`;
      pane.style.width = `${target}px`;
    },
    VIEW_TYPE,
    value,
  );
  await browser.waitUntil(async () => (await geometry()).ownerWidth === value);
}

function mouse(type: string, x: number, y: number) {
  return browser.sendCommandAndGetResult("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    clickCount: 1,
  });
}

async function drag(x: number, y: number, dx: number, dy: number) {
  await mouse("mousePressed", x, y);
  await mouse("mouseMoved", x + dx, y + dy);
  await mouse("mouseReleased", x + dx, y + dy);
}

async function fitNodes() {
  await item("domain-camera-fit").click();
  const covered = await browser.execute((root) => {
    const viewport = document.querySelector(root + " [data-testid=domain-viewport]");
    if (!viewport) return false;
    const bounds = viewport.getBoundingClientRect();
    return [...viewport.querySelectorAll("[data-domain-node]")].every((node) => {
      const box = node.getBoundingClientRect();
      return (
        box.left >= bounds.left - 1 &&
        box.right <= bounds.right + 1 &&
        box.top >= bounds.top - 1 &&
        box.bottom <= bounds.bottom + 1
      );
    });
  }, ROOT);
  expect(covered).toBe(true);
}

function relationshipRows() {
  return browser.execute((root) => {
    const target = document.querySelector(root + " [data-testid=domain-edges]");
    const leaf = target?.closest<HTMLElement>(".workspace-leaf");
    if (!target || !leaf) throw new Error("Missing the relationship list in the real leaf");
    const rows = [...target.querySelectorAll<HTMLButtonElement>("[data-domain-edge-row]")];
    const contains = (outer: DOMRect, inner: DOMRect) =>
      inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 &&
      inner.bottom <= outer.bottom + 1 &&
      inner.left >= outer.left - 1;
    return rows.map((row) => {
      row.scrollIntoView({ block: "center" });
      const leafBox = leaf.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const cardText = Array.from(row.children).flatMap((part) => {
        const range = row.ownerDocument.createRange();
        range.selectNodeContents(part);
        return [...range.getClientRects()];
      });
      const clickable = cardText.every((box) => {
        const hit = row.ownerDocument.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return hit?.closest("[data-domain-edge-row]") === row;
      });
      return {
        id: row.dataset.domainEdgeRow,
        ownerWidth: leafBox.width,
        cardFits: contains(leafBox, rowBox),
        textFits:
          cardText.length > 0 &&
          cardText.every((box) => contains(rowBox, box) && contains(leafBox, box)),
        clickable,
        overflows: [row.scrollWidth - row.clientWidth, row.scrollHeight - row.clientHeight],
      };
    });
  }, ROOT);
}

it("selects parallel, reciprocal and loop graphics and moves the model in an actual 390px split without page overflow", async function () {
  this.timeout(120_000);
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: 1900,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await openView();
  await setViewRoute(domainModelRoute(customerProject, organisation));
  await expect(canvas()).toBeDisplayed();
  await browser.executeObsidian(async ({ app }, type) => {
    const original = app.workspace.getLeavesOfType(type)[0];
    if (!original) throw new Error("Missing product leaf");
    const neighbor = app.workspace.createLeafBySplit(original, "vertical");
    await neighbor.setViewState({ type: "empty", active: false });
  }, VIEW_TYPE);
  await setOwnerWidth(1440);
  expect((await geometry()).pageOverflow).toBe(0);

  for (const relation of ["REL-01", "REL-02", "REL-03", "REL-04"]) {
    const hit = await browser.execute(
      (root, id) => {
        const path = document.querySelector<SVGPathElement>(
          `${root} [data-domain-edge-graphic="${id}"] path`,
        );
        const matrix = path?.getScreenCTM();
        if (!path || !matrix) return;
        for (const fraction of [0.5, 0.33, 0.67, 0.22, 0.78]) {
          const point = path
            .getPointAtLength(path.getTotalLength() * fraction)
            .matrixTransform(matrix);
          const x = Math.round(point.x);
          const y = Math.round(point.y);
          const owner = document.elementFromPoint(x, y)?.closest("[data-domain-edge-graphic]");
          if (owner?.getAttribute("data-domain-edge-graphic") === id) return { x, y };
        }
      },
      ROOT,
      relation,
    );
    expect(hit).toBeDefined();
    if (!hit) throw new Error("No distinct graphic hit point for " + relation);
    await mouse("mousePressed", hit.x, hit.y);
    await mouse("mouseReleased", hit.x, hit.y);
    await browser.waitUntil(
      async () =>
        JSON.stringify(await readViewRoute()) ===
        JSON.stringify(domainModelRoute(customerProject, relation)),
    );
  }

  await setViewRoute(domainModelRoute(customerProject, organisation));
  const bytes = await readVaultText(organisationPath);
  await entity().click();
  const baseline = await geometry();
  await browser.keys(arrowRight);
  expect((await geometry()).modelX).toBe(baseline.modelX + 24);
  await item("domain-model").$("[data-domain-move=ArrowLeft]").click();
  expect((await geometry()).modelX).toBe(baseline.modelX);

  await browser.$(`${ROOT} button[aria-label="Vergrößern"]`).click();
  await browser.waitUntil(async () => (await geometry()).zoom > 1.1);
  await canvas().scrollIntoView({ block: "center" });
  const enlarged = await geometry();
  await drag(Math.round(enlarged.node.x + 28), Math.round(enlarged.node.y + 30), 58, 14);
  const moved = await geometry();
  expect(moved.modelX - enlarged.modelX).toBeCloseTo(58 / enlarged.zoom, 2);
  expect(moved.zoom).toBe(enlarged.zoom);
  await drag(Math.round(moved.view.x + 10), Math.round(moved.view.y + 10), 72, 33);
  const panned = await geometry();
  expect(panned.world.x - moved.world.x).toBeCloseTo(72, 0);
  expect(panned.modelX).toBeCloseTo(moved.modelX, 3);
  await browser.execute(
    (root) => document.querySelector<HTMLElement>(root + " [data-testid=domain-viewport]")?.focus(),
    ROOT,
  );
  await browser.keys(arrowRight);
  expect((await geometry()).world.x).toBeCloseTo(panned.world.x - 40, 0);

  await setOwnerWidth(390);
  await fitNodes();
  const beforeTouch = await geometry();
  const x = Math.round(beforeTouch.view.x + 8);
  const y = Math.round(beforeTouch.view.y + 8);
  await browser.sendCommandAndGetResult("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  await browser.sendCommandAndGetResult("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await browser.sendCommandAndGetResult("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 75, y: y + 39 }],
  });
  await browser.sendCommandAndGetResult("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const afterTouch = await geometry();
  expect(afterTouch.world.x - beforeTouch.world.x).toBeCloseTo(75, 0);
  expect(afterTouch.modelX).toBeCloseTo(beforeTouch.modelX, 3);
  if (afterTouch.pageOverflow) {
    const overflow = await browser.execute((root) => {
      const leaf = document.querySelector(root)?.closest(".workspace-leaf");
      if (!leaf) return [];
      return [leaf, ...leaf.querySelectorAll<HTMLElement>("*")]
        .flatMap((element) => {
          const width = element.getBoundingClientRect().width;
          const scroll = element.scrollWidth - element.clientWidth;
          if (width <= 390 && (scroll <= 0 || element.closest(".pe-domain-viewport"))) return [];
          return [
            {
              name:
                element.getAttribute("data-testid") ||
                element.getAttribute("class") ||
                element.tagName,
              width,
              scroll,
            },
          ];
        })
        .slice(0, 45);
    }, ROOT);
    expect(overflow).toEqual([]);
  }
  expect(afterTouch.pageOverflow).toBe(0);
  expect(await readVaultText(organisationPath)).toBe(bytes);
  const rows = await relationshipRows();
  expect(rows).toHaveLength(5);
  expect(rows).toEqual(
    rows.map(({ id }) => ({
      id,
      ownerWidth: 390,
      cardFits: true,
      textFits: true,
      clickable: true,
      overflows: [0, 0],
    })),
  );
});
