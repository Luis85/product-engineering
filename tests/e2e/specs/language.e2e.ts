import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { catalogFor } from "../../../src/application/messages";
import { PRODUCT_NAME } from "../../../src/application/shell";
import type { Language } from "../../../src/application/shell";
import {
  closeSettings,
  installConsoleSpy,
  openSettings,
  openViewSettings,
  PLUGIN_ID,
  pluginProblems,
  reloadPlugin,
  ROOT,
  SETTINGS_TAB,
  TEST_LANGUAGE,
  writeDataFile,
} from "../support";

async function verifyLanguage(language: Language): Promise<void> {
  const texts = catalogFor(language);
  await browser.waitUntil(
    async () =>
      browser.executeObsidian(
        (_, title) =>
          Array.from(document.querySelectorAll(".notice")).some((notice) =>
            notice.textContent?.includes(title),
          ),
        texts.shell.errors.readOnly.title,
      ),
    { timeoutMsg: `Expected the read-only notice in ${language}` },
  );
  await openViewSettings();
  const frame = browser.$(`${ROOT} [data-testid=app-frame]`);
  await expect(frame).toHaveAttribute("lang", language);
  await expect(browser.$(`${ROOT} [data-testid=items-empty]`)).toHaveText(
    texts.items.settings.empty,
  );

  const registration = await browser.executeObsidian(
    ({ app }, id, name) => {
      const commands = (
        app as unknown as {
          commands: { listCommands: () => readonly { id: string; name: string }[] };
        }
      ).commands.listCommands();
      const ribbon = (app.workspace.leftRibbon as unknown as { items: readonly { id: string }[] })
        .items;
      return {
        open: commands.find((command) => command.id === `${id}:open-view`)?.name,
        diagnostics: commands.find((command) => command.id === `${id}:copy-diagnostics`)?.name,
        ribbon: ribbon.filter((entry) => entry.id === `${id}:${name}`).length,
      };
    },
    PLUGIN_ID,
    PRODUCT_NAME,
  );
  expect(registration).toEqual({
    open: `${PRODUCT_NAME}: ${texts.shell.commands.openView}`,
    diagnostics: `${PRODUCT_NAME}: ${texts.shell.commands.copyDiagnostics}`,
    ribbon: 1,
  });

  await openSettings();
  try {
    const tab = browser.$(SETTINGS_TAB);
    await expect(tab).toHaveText(expect.stringContaining(texts.shell.settingsTab.logLevel.name));
    await expect(tab).toHaveText(
      expect.stringContaining(texts.integrations.settings.ai.codexPath.name),
    );
  } finally {
    await closeSettings();
  }
}

it("localizes views, commands, native settings and notices without changing the ribbon title", async () => {
  await installConsoleSpy();
  await writeDataFile({ schemaVersion: 999 });
  await reloadPlugin();
  await verifyLanguage(TEST_LANGUAGE);

  await browser.executeObsidian(() => window.localStorage.setItem("language", "en"));
  await reloadPlugin();
  await verifyLanguage("en");
  expect(await pluginProblems()).toEqual([]);
});
