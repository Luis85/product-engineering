import { once } from "node:events";
import { get } from "node:http";
import { createServer } from "node:net";
import { $, browser, expect } from "@wdio/globals";
import { catalogFor } from "../../../src/application/messages";
import {
  closeSettings,
  DATA_FILE,
  installConsoleSpy,
  openSettings,
  openView,
  pluginProblems,
  readDataFile,
  readDataText,
  ROOT,
  setTheme,
  SETTINGS_TAB,
  TEST_LANGUAGE,
  writeVaultText,
} from "../support";

const { shell, integrations } = catalogFor(TEST_LANGUAGE);
const { ai, mcp } = integrations.settings;
const dropdown = "select.dropdown:not(.is-measuring)";

function heading(name: string) {
  return $(SETTINGS_TAB).$(`div.setting-item-name=${name}`);
}

function setting(name: string) {
  return heading(name).$("../..");
}

async function stored(key: string, expected: unknown): Promise<void> {
  await browser.waitUntil(async () => {
    const data = await readDataFile();
    return (
      typeof data === "object" &&
      data !== null &&
      (data as Readonly<Record<string, unknown>>)[key] === expected
    );
  });
}

async function configureField(name: string, key: string, value: string | number): Promise<void> {
  const input = setting(name).$("input");
  await input.waitForDisplayed();
  await input.setValue(String(value));
  await browser.keys("Tab");
  await stored(key, value);
}

async function choosePort(): Promise<number> {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  try {
    const address = reservation.address();
    if (!address || typeof address === "string")
      throw new Error("Expected a temporary TCP reservation");
    return address.port;
  } finally {
    await new Promise<void>((resolve, reject) =>
      reservation.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}

function status(endpoint: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const request = get(endpoint, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.once("error", reject);
  });
}

async function verifyAgentControls(): Promise<void> {
  const port = await choosePort();
  await configureField(mcp.port.name, "mcpPort", port);
  await configureField(ai.claudeCodePath.name, "claudeCodePath", "/test-tools/claude");
  await configureField(ai.codexPath.name, "codexPath", "C:\\test-tools\\codex.exe");

  const endpoint = `http://127.0.0.1:${port}/mcp`;
  await heading(mcp.start).click();
  await expect(setting(mcp.title).$(".setting-item-description")).toHaveText(mcp.running(endpoint));
  expect(await status(endpoint)).toBe(401);
  await expect(heading(mcp.copy)).toBeDisplayed();
  await heading(mcp.stop).click();
  await expect(setting(mcp.title).$(".setting-item-description")).toHaveText(mcp.stopped);
  await expect(status(endpoint)).rejects.toThrow(/ECONNREFUSED/);
}

async function themeColors(theme: "light" | "dark") {
  await setTheme(theme);
  await $(ROOT + "." + theme).waitForExist();
  return browser.executeObsidian(
    (_, selector) => {
      const surface = document.querySelector(selector);
      if (!surface) throw new Error("Expected a themed surface");
      const host = getComputedStyle(document.body);
      const app = getComputedStyle(surface);
      return {
        hostBackground: host.getPropertyValue("--background-primary").trim(),
        hostText: host.getPropertyValue("--text-normal").trim(),
        surfaceBackground: app.getPropertyValue("--pe-bg").trim(),
        surfaceText: app.getPropertyValue("--pe-text").trim(),
      };
    },
    ROOT + "." + theme,
  );
}

async function verifyReadOnly(): Promise<void> {
  await browser.switchToWindow(await browser.getObsidianPage().getMainWindowHandle());
  const unchanged = JSON.stringify({ schemaVersion: 99, logLevel: "error", futureSetting: true });
  await writeVaultText(DATA_FILE, unchanged);
  const readOnly = shell.errors.readOnly;
  await browser.waitUntil(
    () =>
      browser.executeObsidian(
        (_, title) =>
          Array.from(document.querySelectorAll(".notice")).some((notice) =>
            notice.textContent?.includes(title),
          ),
        readOnly.title,
      ),
    { timeoutMsg: "Expected a read-only notice in the workspace" },
  );
  await openSettings();
  await expect(heading(readOnly.title)).toBeDisplayed();
  await expect(setting(shell.settingsTab.logLevel.name).$(dropdown)).not.toBeEnabled();
  await expect(setting(mcp.port.name).$("input")).not.toBeEnabled();
  await expect(setting(ai.codexPath.name).$("input")).not.toBeEnabled();
  expect(await readDataText()).toBe(unchanged);
}

it("uses native technical settings, follows the host theme, and preserves newer data", async () => {
  await installConsoleSpy();
  await openView();
  await openSettings();
  const controls = await Promise.all([
    setting(shell.settingsTab.logLevel.name).$$(dropdown),
    setting(mcp.port.name).$$('input[type="text"]'),
    setting(ai.claudeCodePath.name).$$('input[type="text"]'),
    setting(ai.codexPath.name).$$('input[type="text"]'),
  ]);
  expect(controls.map((row) => row.length)).toEqual([1, 1, 1, 1]);

  const select = setting(shell.settingsTab.logLevel.name).$(dropdown);
  await select.selectByAttribute("value", "debug");
  await stored("logLevel", "debug");
  await verifyAgentControls();

  await closeSettings();
  const light = await themeColors("light");
  const dark = await themeColors("dark");
  expect(light.hostBackground).not.toBe("");
  expect(dark.hostText).not.toBe("");
  expect(light.surfaceBackground).toBe(light.hostBackground);
  expect(light.surfaceText).toBe(light.hostText);
  expect(dark.surfaceBackground).toBe(dark.hostBackground);
  expect(dark.surfaceText).toBe(dark.hostText);
  expect(dark.hostBackground).not.toBe(light.hostBackground);

  await verifyReadOnly();
  expect(await pluginProblems()).toEqual([]);
});
