import { $, browser, expect } from "@wdio/globals";
import { catalogFor } from "../../../src/application/messages";
import {
  closeSettings,
  installConsoleSpy,
  openSettings,
  pluginProblems,
  readDataFile,
  SETTINGS_TAB,
  TEST_LANGUAGE,
  writeVaultText,
} from "../support";

const first = { id: "item-00000000-0000-0000-0000-000000000041", title: "Item shared by choice" };
const second = { id: "item-00000000-0000-0000-0000-000000000042", title: "Item kept private" };

function itemText({ id, title }: typeof first): string {
  return `---\nschema: product-engineering.item/v1\nid: ${id}\ntitle: ${title}\nstatus: open\n---\n\nSynthetic fixture body.\n`;
}

function sharedToggle(title: string) {
  return $(SETTINGS_TAB).$(`div.setting-item-name=${title}`).$("../..").$(".checkbox-container");
}

function persistedItems(): Promise<unknown> {
  return readDataFile().then((data) =>
    typeof data === "object" && data !== null && "mcpSharedItemIds" in data
      ? data.mcpSharedItemIds
      : undefined,
  );
}

it("uses native controls to select and revoke sharing for an indexed item", async () => {
  await installConsoleSpy();
  await writeVaultText("Product Engineering/Items/Shared.md", itemText(first));
  await writeVaultText("Product Engineering/Items/Private.md", itemText(second));
  await openSettings();
  const selected = sharedToggle(first.title);
  const unselected = sharedToggle(second.title);
  await selected.waitForDisplayed();
  await unselected.waitForDisplayed();
  expect(await persistedItems()).toBeUndefined();

  await selected.click();
  await browser.waitUntil(
    async () => JSON.stringify(await persistedItems()) === JSON.stringify([first.id]),
    {
      timeoutMsg: "The native sharing toggle did not store the selected ID",
    },
  );
  expect(await persistedItems()).toEqual([first.id]);

  const mcp = catalogFor(TEST_LANGUAGE).integrations.settings.mcp;
  const controls = $(SETTINGS_TAB);
  await controls.$(`div.setting-item-name=${mcp.start}`).click();
  const status = controls
    .$(`div.setting-item-name=${mcp.title}`)
    .$("../..")
    .$(".setting-item-description");
  await expect(status).toHaveText(/127\.0\.0\.1:\d+\/mcp/);
  await sharedToggle(first.title).click();
  await browser.waitUntil(async () => (await persistedItems()) === undefined, {
    timeoutMsg: "The native sharing toggle did not remove the selected ID",
  });
  await controls.$(`div.setting-item-name=${mcp.stop}`).click();
  await expect(status).toHaveText(mcp.stopped);
  await closeSettings();
  expect(await pluginProblems()).toEqual([]);
});
