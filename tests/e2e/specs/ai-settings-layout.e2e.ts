import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { closeSettings, openSettings, readDataText, setTheme, SETTINGS_TAB } from "../support";

const requiredLabels = ["KI-Copilot", "KI-Copilot aktivieren", "Modellanbindung", "Betriebsart"];

function measureSettings() {
  return browser.execute(
    (selector, labels) => {
      const tab = document.querySelector<HTMLElement>(selector);
      const nav = document.querySelector<HTMLElement>(".vertical-tab-header");
      const mode = tab?.querySelector<HTMLSelectElement>('select:has(option[value="demo"])');
      if (!tab || !nav || !mode) throw new Error("Expected the native settings tab and controls");

      const headings = [...tab.querySelectorAll<HTMLElement>(".setting-item-name")];
      const visibleWidths = labels.map((label) => {
        const node = headings.find((heading) => heading.textContent?.trim() === label);
        if (!node) throw new Error(`Native setting label unavailable: ${label}`);
        const range = document.createRange();
        range.selectNodeContents(node);
        const bounds = node.getBoundingClientRect();
        const fullyVisible = [...range.getClientRects()].every(
          (line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1,
        );
        return { label, width: Math.round(bounds.width), fullyVisible };
      });
      const consent = headings.find((node) => node.textContent?.trim() === "KI-Copilot aktivieren");
      const help = consent?.parentElement?.querySelector<HTMLElement>(".setting-item-description");
      const canvas = document.createElement("canvas").getContext("2d");
      if (!help || !canvas)
        throw new Error("Expected the native consent help and text measurement");
      const modeStyle = getComputedStyle(mode);
      canvas.font = `${modeStyle.fontWeight} ${modeStyle.fontSize} ${modeStyle.fontFamily}`;
      const modeText = mode.selectedOptions[0]?.textContent?.trim() ?? "";
      const modeSpace =
        mode.clientWidth - parseFloat(modeStyle.paddingLeft) - parseFloat(modeStyle.paddingRight);
      return {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        navWidth: nav.getBoundingClientRect().width,
        activeTab: nav.querySelector(".is-active")?.textContent?.trim(),
        theme: document.body.classList.contains("theme-dark") ? "dark" : "light",
        noHorizontalScroll: tab.scrollWidth <= tab.clientWidth,
        visibleWidths,
        helpWidth: Math.round(help.getBoundingClientRect().width),
        helpHeight: Math.round(help.getBoundingClientRect().height),
        modeText,
        modeSpace,
        neededModeSpace: Math.ceil(canvas.measureText(modeText).width),
      };
    },
    SETTINGS_TAB,
    requiredLabels,
  );
}

async function setViewport(width: number) {
  await browser.sendCommandAndGetResult("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

it("keeps the native consent and mode text readable at 390px in light and dark", async () => {
  for (const [width, theme] of [
    [1440, "light"],
    [390, "light"],
    [390, "dark"],
  ] as const) {
    await setTheme(theme);
    await openSettings();
    try {
      await setViewport(width);
      const measured = await measureSettings();
      expect(measured).toMatchObject({
        width,
        height: 900,
        dpr: 1,
        activeTab: "Product Engineering",
        theme,
        noHorizontalScroll: true,
        modeText: "Lokale Demo",
      });
      expect(measured.navWidth).toBeGreaterThan(0);
      expect(
        measured.visibleWidths.filter((label) => !label.fullyVisible || label.width < 60),
      ).toEqual([]);
      expect(measured.helpWidth).toBeGreaterThanOrEqual(100);
      expect(measured.helpHeight).toBeLessThanOrEqual(115);
      expect(measured.modeSpace).toBeGreaterThanOrEqual(measured.neededModeSpace - 1);
      if (width === 390) {
        await browser.$(".vertical-tab-header").$(".vertical-tab-nav-item=Editor").click();
        await expect(browser.$(SETTINGS_TAB)).not.toBeDisplayed();
        const active = await browser.execute(() => ({
          tab: document.querySelector(".vertical-tab-header .is-active")?.textContent?.trim(),
          ownedTabVisible: [...document.querySelectorAll(".pe-native-settings")].some(
            (candidate) => candidate.getClientRects().length > 0,
          ),
        }));
        expect(active).toEqual({ tab: "Editor", ownedTabVisible: false });
      }
    } finally {
      await browser.sendCommandAndGetResult("Emulation.clearDeviceMetricsOverride", {});
      await closeSettings();
    }
  }
});

it("associates native invalid executable feedback and clears it after keyboard correction", async () => {
  await openSettings();
  await setViewport(390);
  const row = browser.$(SETTINGS_TAB).$(".setting-item-name=Codex-Programmdatei").$("../..");
  const path = row.$("input");
  try {
    const savedPath = "C:/PE Fixture/codex.exe";
    await path.setValue(savedPath);
    await browser.waitUntil(async () => (await readDataText())?.includes(savedPath) === true);
    const before = await readDataText();
    await browser.keys(["Control", "a"]);
    await browser.keys("relative-codex.exe");
    await expect(path).toHaveValue("relative-codex.exe");
    await expect(path).toBeFocused();
    await expect(row).toHaveText(
      expect.stringContaining("Gib den absoluten Pfad zur ausführbaren Datei von Codex ein"),
    );
    expect(await readDataText()).toBe(before);
    await expect(path).toHaveAttribute("aria-invalid", "true");
    const announcement = row.$('[role="alert"]');
    await expect(announcement).toHaveText(expect.stringContaining("Gib den absoluten Pfad"));
    const messageId = await announcement.getAttribute("id");
    expect(messageId).toBeTruthy();
    expect((await path.getAttribute("aria-describedby"))?.split(/\s+/)).toContain(messageId);

    await browser.keys(["Control", "a"]);
    await browser.keys("Backspace");
    await expect(path).toHaveValue("");
    await expect(path).toBeFocused();
    await expect(path).not.toHaveAttribute("aria-invalid", "true");
    expect((await path.getAttribute("aria-describedby"))?.split(/\s+/) ?? []).not.toContain(
      messageId,
    );
    await expect(announcement).not.toBeDisplayed();
  } finally {
    await browser.sendCommandAndGetResult("Emulation.clearDeviceMetricsOverride", {});
    await closeSettings();
  }
});
