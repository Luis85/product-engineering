import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { browser, expect } from "@wdio/globals";
import { before, it } from "mocha";
import { knowledgeDetailRoute } from "../../../src/application/knowledge";
import { splitNoteText } from "../../../src/domain/notes";
import { jobPath, prdPath, seedKnowledgeDetailVault } from "../knowledge-detail-vault";
import { customerProject, customerRequirement } from "../knowledge-vault";
import {
  openView,
  readVaultText,
  readViewRoute,
  reloadPlugin,
  ROOT,
  setTheme,
  setViewRoute,
  VIEW_TYPE,
  writeDataFile,
  writeVaultText,
} from "../support";

const route = knowledgeDetailRoute(customerProject, customerRequirement);
const control = (id: string) => browser.$(`${ROOT} [data-testid=${id}]`);
const copilotSheet = () => browser.$(`${ROOT} .pe-copilot-sheet`);
const desktopWidth = 1740;
const leafHeight = 900;
const prompt = "Prüfe den aktuellen Stand auf Lücken und offene Entscheidungen.";
const referenceBody = [
  "## Problem",
  "Koordinatorinnen können gefilterte offene Servicefälle nur mit mehreren manuellen Schritten weitergeben.",
  "## REQ-18 · Ergebnis",
  "Berechtigte Koordinatorinnen können alle für sie sichtbaren gefilterten Servicefälle vollständig weitergeben.",
  "## Umfang",
  "Offene Fälle der eigenen Organisation. Bereits erfasste Filter gelten auch für die Übergabeliste.",
  "## Erfolgskriterium",
  "Gefilterte Fälle aus mehreren Seiten werden in einem Durchgang und innerhalb von drei Minuten weitergegeben.",
].join("\n\n");

before(async () => {
  await seedKnowledgeDetailVault();
  const record = await readVaultText(prdPath);
  if (!record) throw new Error("Missing comparison PRD");
  const { body } = splitNoteText(record);
  await writeVaultText(
    prdPath,
    record.slice(0, record.length - body.length) + "\n" + referenceBody + "\n",
  );
  await writeDataFile({ schemaVersion: 1, aiEnabled: true, aiMode: "demo" });
  await reloadPlugin();
  await openView();
  await setViewRoute(route);
});

async function setViewport(height: number) {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width: desktopWidth,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

function leafSize() {
  return browser.execute((scope) => {
    const leaf = document.querySelector(scope)?.closest(".workspace-leaf");
    if (!leaf) throw new Error("Expected the Copilot comparison leaf");
    const { width, height } = leaf.getBoundingClientRect();
    return { width, height };
  }, ROOT);
}

async function openComparisonSplit() {
  await setViewport(leafHeight + 40);
  await browser.executeObsidian(
    async ({ app }, type, path) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      const note = app.vault.getFileByPath(path);
      if (!leaf || !note) throw new Error("Missing product or adjacent note fixture");
      const neighbor = app.workspace.getLeaf("split", "vertical");
      await neighbor.openFile(note);
      neighbor.view.containerEl.dataset.e2e = "copilot-comparison-neighbor";
      await app.workspace.revealLeaf(leaf);
    },
    VIEW_TYPE,
    jobPath,
  );
}

async function fitComparisonLeaf(width: number) {
  await browser.executeObsidian(
    ({ app }, type, leafWidth) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      const tabs = leaf?.view.containerEl.closest<HTMLElement>(".workspace-tabs");
      if (!tabs) throw new Error("Expected the Copilot split tabs");
      tabs.style.flex = "0 0 " + leafWidth + "px";
    },
    VIEW_TYPE,
    width,
  );
  const viewportHeight = await browser.execute(() => innerHeight);
  const height = viewportHeight + leafHeight - (await leafSize()).height;
  if (height !== viewportHeight) await setViewport(height);
  await browser.waitUntil(
    async () => {
      const size = await leafSize();
      return size.width === width && size.height === leafHeight;
    },
    { timeoutMsg: `The actual Copilot leaf did not reach ${width} × ${leafHeight} CSS px` },
  );
}

async function closeComparisonSplit() {
  try {
    if (await browser.$(`${ROOT} .pe-copilot-sheet[data-state=open]`).isExisting()) {
      await browser.keys("Escape");
    }
    await copilotSheet().waitForExist({ reverse: true });
  } finally {
    await browser.executeObsidian(({ app }, type) => {
      const leaf = app.workspace.getLeavesOfType(type)[0];
      leaf?.view.containerEl.closest<HTMLElement>(".workspace-tabs")?.style.removeProperty("flex");
      app.workspace
        .getLeavesOfType("markdown")
        .find(({ view }) => view.containerEl.dataset.e2e === "copilot-comparison-neighbor")
        ?.detach();
    }, VIEW_TYPE);
    await browser.sendCommandAndGetResult("Emulation.clearDeviceMetricsOverride", {});
  }
}

function metrics() {
  return browser.execute(() => {
    const sheet = document.querySelector<HTMLElement>(".pe-copilot-sheet");
    const leaf = sheet?.closest(".workspace-leaf");
    const sources = sheet?.querySelector<HTMLElement>("[data-testid=copilot-selected-sources]");
    const composer = sheet?.querySelector<HTMLTextAreaElement>("[data-testid=copilot-prompt]");
    const mode = sheet?.querySelector<HTMLSelectElement>("[data-testid=copilot-mode]");
    if (!sheet || !leaf || !sources || !composer || !mode)
      throw new Error("Expected contextual Review dialog and its owning leaf");
    const bounds = (element: Element) => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return {
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      leaf: bounds(leaf),
      sheet: bounds(sheet),
      scrollWidth: sheet.scrollWidth,
      clientWidth: sheet.clientWidth,
      accessibleModal: sheet.getAttribute("aria-modal"),
      theme: document.body.classList.contains("theme-dark") ? "dark" : "light",
      title: sheet.querySelector("[data-slot=title]")?.textContent?.trim(),
      sources: sources.textContent?.trim(),
      provider: sheet.querySelector(".pe-copilot-project p")?.textContent?.trim(),
      mode: mode.value,
      prompt: composer.value,
      chevrons: [...sheet.querySelectorAll<HTMLSelectElement>("select")].map((select) => {
        const icon = select.parentElement?.querySelector<SVGElement>(
          "svg.pe-copilot-select-chevron",
        );
        return (
          icon && {
            width: Math.round(icon.getBoundingClientRect().width),
            pointerEvents: getComputedStyle(icon).pointerEvents,
            hidden: icon.getAttribute("aria-hidden"),
          }
        );
      }),
    };
  });
}

function expectSheetInsideLeaf({ sheet: panel, leaf }: Awaited<ReturnType<typeof metrics>>) {
  expect(panel.x).toBeGreaterThanOrEqual(leaf.x);
  expect(panel.y).toBeGreaterThanOrEqual(leaf.y);
  expect(panel.right).toBeLessThanOrEqual(leaf.right);
  expect(panel.bottom).toBeLessThanOrEqual(leaf.bottom);
}

it("matches the German light contextual review at 1440 and 390 with keyboard focus return", async () => {
  const capture = process.env.PE_COPILOT_CAPTURE_DIR;
  if (capture) await mkdir(capture, { recursive: true });
  try {
    await openComparisonSplit();
    for (const [width, theme] of [
      [1440, "light"],
      [390, "light"],
      [390, "dark"],
    ] as const) {
      await setTheme(theme);
      await fitComparisonLeaf(width);
      const actions = control("knowledge-note-actions");
      await actions.waitForDisplayed();
      await actions.click();
      await expect(control("knowledge-export")).toBeFocused();
      await browser.keys("Tab");
      await browser.keys("Tab");
      await expect(control("knowledge-ai-review")).toBeFocused();
      await browser.keys("Enter");
      await expect(control("copilot-selected-sources")).toHaveText(
        "PRD-03 · Servicefälle übergeben",
      );
      await expect(control("copilot-prompt")).toHaveValue(prompt);
      await expect(browser.$(".pe-copilot-sheet [data-autofocus]")).toBeFocused();
      expect(await readViewRoute()).toEqual(route);
      const observed = await metrics();
      expect(observed).toMatchObject({
        leaf: { width, height: leafHeight },
        dpr: 1,
        theme,
        accessibleModal: width === 390 ? "true" : null,
        sources: "PRD-03 · Servicefälle übergeben",
        provider: "Lokale Demo",
        mode: "review",
        prompt,
      });
      expect(observed.sheet.width).toBeGreaterThanOrEqual(width === 390 ? 330 : 380);
      expect(observed.sheet.width).toBeLessThanOrEqual(width === 390 ? 352 : 420);
      expectSheetInsideLeaf(observed);
      expect(observed.scrollWidth).toBeLessThanOrEqual(observed.clientWidth);
      expect(observed.chevrons).toEqual(
        Array.from({ length: 3 }, () => ({
          width: 16,
          pointerEvents: "none",
          hidden: "true",
        })),
      );
      if (capture && theme === "light") {
        const { x, y, width: captureWidth, height } = observed.leaf;
        const { data } = (await browser.sendCommandAndGetResult("Page.captureScreenshot", {
          format: "png",
          clip: { x, y, width: captureWidth, height, scale: 1 },
        })) as { readonly data: string };
        await writeFile(
          join(capture, `V24-native-copilot-${captureWidth}.png`),
          Buffer.from(data, "base64"),
        );
        await writeFile(
          join(capture, `V24-native-copilot-${captureWidth}.json`),
          JSON.stringify({ ...observed, route }, null, 2),
        );
      }
      if (theme === "dark") {
        await control("copilot-choose-sources").click();
        const selector = `${ROOT} [data-testid=copilot-source][value="knowledge:${customerRequirement}"]`;
        const source = browser.$(selector);
        await browser.execute((target) => {
          document.querySelector<HTMLInputElement>(target)?.focus();
        }, selector);
        await browser.keys("Space");
        await expect(source).not.toBeSelected();
        await browser.keys("Space");
        await expect(source).toBeSelected();
        await control("copilot-mode").selectByAttribute("value", "draft");
        await expect(control("copilot-draft-kind")).toBeDisplayed();
        expect((await metrics()).chevrons).toEqual(observed.chevrons);
      }
      await browser.keys("Escape");
      await expect(control("copilot-workspace")).not.toExist();
      await expect(actions).toBeFocused();
    }
  } finally {
    await closeComparisonSplit();
  }
});

it("keeps the sheet and its keyboard focus in a narrow pop-out owner", async () => {
  await expect(copilotSheet()).not.toExist();
  const main = await browser.getWindowHandle();
  const existingWindows = await browser.getWindowHandles();
  await browser.executeObsidian(({ app }, type) => {
    const leaf = app.workspace.getLeavesOfType(type)[0];
    if (!leaf) throw new Error("Missing comparison leaf");
    app.workspace.moveLeafToPopout(leaf);
  }, VIEW_TYPE);
  try {
    await browser.waitUntil(async () =>
      (await browser.getWindowHandles()).some((handle) => !existingWindows.includes(handle)),
    );
    await browser.executeObsidian(({ app }, type) => {
      const leaf = app.workspace
        .getLeavesOfType(type)
        .find(({ view }) => view.containerEl.ownerDocument !== document);
      if (!leaf) throw new Error("Missing pop-out leaf");
      const root = leaf.view.containerEl;
      const pane = root.closest<HTMLElement>(".workspace-leaf");
      if (!pane) throw new Error("Missing pop-out pane");
      pane.style.flex = "0 0 390px";
      pane.style.width = "390px";
    }, VIEW_TYPE);
    const popout = (await browser.getWindowHandles()).find(
      (handle) => !existingWindows.includes(handle),
    );
    if (!popout) throw new Error("The comparison pop-out did not open");
    await browser.switchToWindow(popout);
    await browser.waitUntil(async () => (await leafSize()).width === 390, {
      timeoutMsg: "The Copilot pop-out did not reach a 390 CSS px owning leaf",
    });
    const actions = control("knowledge-note-actions");
    await actions.waitForDisplayed();
    await actions.click();
    await control("knowledge-ai-review").click();
    await expect(browser.$(".pe-copilot-sheet[data-state=open]")).toHaveAttribute(
      "aria-modal",
      "true",
    );
    await expect(browser.$(".pe-copilot-sheet [data-autofocus]")).toBeFocused();
    const observed = await metrics();
    expect(observed.leaf.width).toBe(390);
    expectSheetInsideLeaf(observed);
    await browser.keys("Escape");
    await expect(control("copilot-workspace")).not.toExist();
    await expect(actions).toBeFocused();
  } finally {
    await browser.switchToWindow(main);
    await browser.executeObsidian(({ app }, type) => {
      app.workspace
        .getLeavesOfType(type)
        .find(({ view }) => view.containerEl.ownerDocument !== document)
        ?.detach();
    }, VIEW_TYPE);
  }
});
