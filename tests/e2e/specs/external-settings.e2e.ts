import { $, browser, expect } from "@wdio/globals";
import { catalogFor } from "../../../src/application/messages";
import {
  closeSettings,
  DATA_FILE,
  installConsoleSpy,
  openSettings,
  openView,
  PLUGIN_ID,
  pluginProblems,
  readDataText,
  ROOT,
  SETTINGS_TAB,
  TEST_LANGUAGE,
  writeDataFile,
  writeVaultText,
} from "../support";

const { shell } = catalogFor(TEST_LANGUAGE);
const settingsScreen = ROOT + ' [data-testid="settings-screen"]';
const select = () =>
  $(SETTINGS_TAB)
    .$(`div.setting-item-name=${shell.settingsTab.logLevel.name}`)
    .$("../..")
    .$("select.dropdown:not(.is-measuring)");

type DiagnosticsCapture = {
  expectedLevel: string | undefined;
  readonly restore: () => void;
};
type TestWindow = typeof window & { diagnosticsCapture?: DiagnosticsCapture };

async function readRuntimeLevel(): Promise<string | undefined> {
  await browser.executeObsidian(() => {
    const container = window as TestWindow;
    const clipboard = navigator.clipboard;
    const original = Object.getOwnPropertyDescriptor(clipboard, "writeText");
    const capture: DiagnosticsCapture = {
      expectedLevel: undefined,
      restore() {
        if (original) Object.defineProperty(clipboard, "writeText", original);
        else Reflect.deleteProperty(clipboard, "writeText");
        Reflect.deleteProperty(container, "diagnosticsCapture");
      },
    };

    container.diagnosticsCapture = capture;
    Object.defineProperty(clipboard, "writeText", {
      configurable: true,
      value: (text: string): Promise<void> => {
        capture.expectedLevel = /^Log level: (\w+)$/m.exec(text)?.[1];
        return Promise.resolve();
      },
    });
  });
  try {
    await browser.executeObsidianCommand(PLUGIN_ID + ":copy-diagnostics");
    await browser.waitUntil(() =>
      browser.executeObsidian(
        () => (window as TestWindow).diagnosticsCapture?.expectedLevel !== undefined,
      ),
    );
    return await browser.executeObsidian(
      () => (window as TestWindow).diagnosticsCapture?.expectedLevel,
    );
  } finally {
    await browser.executeObsidian(() => {
      (window as TestWindow).diagnosticsCapture?.restore();
    });
  }
}

it("reloads external data in place and preserves a newer file while the view remains open", async () => {
  await installConsoleSpy();
  await openView();
  await $(settingsScreen).waitForExist();
  await openSettings();
  await writeDataFile({ schemaVersion: 1, logLevel: "debug" });
  await expect(select()).toHaveValue("debug");
  await closeSettings();
  expect(await readRuntimeLevel()).toBe("debug");
  await $(settingsScreen).waitForDisplayed();

  await openSettings();
  const unchanged = JSON.stringify({
    schemaVersion: 99,
    logLevel: "info",
    futureValue: "leave alone",
  });
  await writeVaultText(DATA_FILE, unchanged);
  await expect(select()).not.toBeEnabled();
  const leader = $(SETTINGS_TAB).$(`div.setting-item-name=${shell.errors.readOnly.title}`);
  await expect(leader).toBeDisplayed();
  await closeSettings();
  expect(await readRuntimeLevel()).toBe("warn");
  await $(settingsScreen).waitForDisplayed();
  expect(await readDataText()).toBe(unchanged);
  expect(await pluginProblems()).toEqual([]);
});
