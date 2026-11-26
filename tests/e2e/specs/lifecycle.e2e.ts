import { browser, expect } from "@wdio/globals";
import { appRoutes } from "../../../src/application/routes";
import { PRODUCT_NAME } from "../../../src/application/shell";
import {
  disablePlugin,
  enablePlugin,
  installConsoleSpy,
  openView,
  PLUGIN_ID,
  pluginProblems,
  ROOT,
  VIEW_TYPE,
} from "../support";

const surface = ROOT + ' [data-testid="project-workspace"]';

function viewCount(): Promise<number> {
  return browser.executeObsidian(
    ({ app }, type) => app.workspace.getLeavesOfType(type).length,
    VIEW_TYPE,
  );
}

function ribbonState(
  redraw = false,
): Promise<readonly { callback: boolean; connected: boolean }[]> {
  return browser.executeObsidian(
    ({ app }, id, render) => {
      const { leftRibbon } = app.workspace as unknown as {
        leftRibbon: {
          items: object;
          onChange: () => void;
        };
      };
      if (render) leftRibbon.onChange();
      const entries: [unknown, unknown][] =
        leftRibbon.items instanceof Map
          ? [...(leftRibbon.items as ReadonlyMap<unknown, unknown>).entries()]
          : Object.entries(leftRibbon.items);
      return entries.flatMap(([key, item]) => {
        if (typeof item !== "object" || item === null) return [];
        const entry = item as { id?: unknown; callback?: unknown; buttonEl?: HTMLElement };
        if (key !== id && entry.id !== id) return [];
        return [
          {
            callback: typeof entry.callback === "function",
            connected: entry.buttonEl?.isConnected === true,
          },
        ];
      });
    },
    PLUGIN_ID + ":" + PRODUCT_NAME,
    redraw,
  );
}

async function expectRibbon(active: boolean): Promise<void> {
  const expected = [{ callback: active, connected: active }];
  expect(await ribbonState()).toEqual(expected);
  expect(await ribbonState(true)).toEqual(expected);
}

it("reuses open views and restores cleanly through three enable cycles", async () => {
  await installConsoleSpy();
  await expectRibbon(true);
  await openView();
  await browser.$(surface).waitForExist();
  expect(
    await browser.executeObsidian(
      ({ app }, type) => app.workspace.getLeavesOfType(type)[0]?.getViewState().state?.route,
      VIEW_TYPE,
    ),
  ).toEqual(appRoutes.start);

  await openView();
  expect(await viewCount()).toBe(1);
  await browser.executeObsidian(async ({ app }, type) => {
    const leaf = app.workspace.getLeaf("tab");
    await leaf.setViewState({ type, active: true });
    await app.workspace.revealLeaf(leaf);
  }, VIEW_TYPE);
  await browser.waitUntil(async () => (await browser.$$(surface)).length === 2);

  await browser.executeObsidian(({ app }, type) => {
    app.workspace.getLeavesOfType(type)[0]?.detach();
  }, VIEW_TYPE);
  await browser.waitUntil(async () => (await viewCount()) === 1);
  await openView();
  await browser.$(surface).waitForDisplayed();
  expect(await viewCount()).toBe(1);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await disablePlugin();
    await browser.waitUntil(async () => (await viewCount()) === 0);
    await expectRibbon(false);
    await enablePlugin();
    await expectRibbon(true);
    await openView();
    await browser.$(surface).waitForDisplayed();
    expect(await viewCount()).toBe(1);
  }
  expect(await pluginProblems()).toEqual([]);
});
