import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { pbiDetailRoute } from "../../../src/application/backlog";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { pbiId, pbiTitle, seedPbiVault } from "../pbi-vault";
import { openView, ROOT, setTheme, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const dialog = () => browser.$(`${ROOT} [role="dialog"][data-state="open"]`);

before(async () => {
  await seedPbiVault();
  await openView();
  await setTheme("light");
  await setViewRoute(pbiDetailRoute(customerProject, pbiId));
  await expect(el("pbi-detail").$("h1")).toHaveText(pbiTitle);
  await el("pbi-tab-companions").click();
});

function viewport(width: number) {
  return browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height: 940,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function sizeLeaf(width: number) {
  if (width === 1440) {
    await viewport(1484);
    return;
  }
  if (width === 390) await narrowKnowledgeLeaf();
  await viewport(1740);
  await browser.execute(
    (surface: HTMLElement, size) => {
      const leaf = surface.closest<HTMLElement>(".workspace-leaf");
      if (!leaf) throw new Error("Missing PBI leaf");
      leaf.style.flex = `0 0 ${size}px`;
      leaf.style.width = size + "px";
    },
    await el("pbi-detail"),
    width,
  );
}

async function measureChooser() {
  return browser.execute(
    async (panel: HTMLElement) => {
      await Promise.all(panel.getAnimations().map((animation) => animation.finished));
      const doc = panel.ownerDocument;
      const leaf = panel.closest<HTMLElement>(".workspace-leaf");
      if (!leaf) throw new Error("Missing chooser leaf");
      const choices = [
        ...panel.querySelectorAll<HTMLButtonElement>("button[data-testid^=pbi-companion-]"),
      ].map((choice) => {
        const outer = choice.getBoundingClientRect();
        const lines = (["aria-labelledby", "aria-describedby"] as const).flatMap((attribute) => {
          const text = doc.getElementById(choice.getAttribute(attribute) ?? "");
          if (!text) throw new Error("Missing chooser text for " + attribute);
          const range = doc.createRange();
          range.selectNodeContents(text);
          return [...range.getClientRects()]
            .filter(({ width }) => width > 0)
            .map((rect) => {
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              return {
                attribute,
                x,
                y,
                inside:
                  rect.left >= outer.left &&
                  rect.right <= outer.right &&
                  rect.top >= outer.top &&
                  rect.bottom <= outer.bottom,
                hit: doc.elementFromPoint(x, y)?.closest("button")?.dataset.testid,
              };
            });
        });
        return { id: choice.dataset.testid, height: outer.height, lines };
      });
      const neighbor = [...doc.querySelectorAll(".mod-root .workspace-leaf")].some(
        (other) => other !== leaf && other.getBoundingClientRect().width > 0,
      );
      return {
        width: leaf.getBoundingClientRect().width,
        neighbor,
        choices,
        fits: panel.scrollWidth <= panel.clientWidth + 1,
      };
    },
    await dialog(),
  );
}

async function openChooser() {
  await el("pbi-add-companion").click();
  await expect(dialog()).toBeDisplayed();
  await expect(el("pbi-companion-TASK")).toBeFocused();
}

async function clickWrappedPurpose(id: string, choice: Awaited<ReturnType<typeof measureChooser>>) {
  const purpose = choice.choices
    .find((button) => button.id === id)
    ?.lines.filter(({ attribute }) => attribute === "aria-describedby");
  if (!purpose || purpose.length < 2) throw new Error("Expected a wrapped purpose at phone width");
  const line = purpose.at(-1);
  if (!line) throw new Error("Missing last purpose line");
  const { x, y } = line;
  for (const type of ["mousePressed", "mouseReleased"] as const) {
    await browser.sendCommandAndGetResult("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  }
  await expect(el("backlog-form").$("input[name=title]")).toBeFocused();
  return dialog().$("h2").getText();
}

it("contains every chooser text line and hits its own button at desktop and narrow widths", async () => {
  const snapshots = [];
  for (const width of [1440, 390, 320]) {
    await sizeLeaf(width);
    await openChooser();
    const snapshot = await measureChooser();
    expect(snapshot.width).toBe(width);
    expect(snapshot.neighbor).toBe(width !== 1440);
    expect(snapshot.choices).toHaveLength(4);
    expect(snapshot.fits).toBe(true);
    snapshots.push(snapshot);
    if (width !== 320) await browser.keys("Escape");
  }
  const phone = snapshots.at(-1);
  if (!phone) throw new Error("Missing phone layout");
  const task = await clickWrappedPurpose("pbi-companion-TASK", phone);
  await browser.keys("Escape");
  await expect(el("pbi-add-companion")).toBeFocused();
  await openChooser();
  const bug = await clickWrappedPurpose("pbi-companion-BUG", await measureChooser());
  await browser.keys("Escape");
  await expect(el("pbi-add-companion")).toBeFocused();
  const violations = snapshots.flatMap(({ width, choices }) =>
    choices.flatMap(({ id, height, lines }) => {
      expect(height).toBeGreaterThanOrEqual(44);
      expect(new Set(lines.map(({ attribute }) => attribute)).size).toBe(2);
      return lines
        .filter(({ hit, inside }) => !inside || hit !== id)
        .map(({ attribute, hit, inside }) => ({ width, id, attribute, hit, inside }));
    }),
  );
  expect({ violations, task, bug }).toEqual({
    violations: [],
    task: `Task erfassen · ${pbiId}`,
    bug: `Bug erfassen · ${pbiId}`,
  });
});
