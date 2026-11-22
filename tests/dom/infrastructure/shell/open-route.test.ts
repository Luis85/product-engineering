import { ItemView, Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import type { Route } from "../../../../src/application/routes";
import { openRoute } from "../../../../src/infrastructure/obsidian/shell/open-route";
import { SHELL_VIEW_TYPE } from "../../../../src/infrastructure/obsidian/shell/shell-view";

vi.mock("obsidian", () => import("@test/obsidian"));

class TestPlugin extends Plugin {}

class RouteProbe extends ItemView {
  override getViewType() {
    return SHELL_VIEW_TYPE;
  }
  override getDisplayText() {
    return "Route probe";
  }
}

function routeFixture() {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  plugin.registerView(SHELL_VIEW_TYPE, (leaf) => new RouteProbe(leaf));
  return { workspace: plugin.app.workspace, host: registry.plugin.app.workspace };
}

const settings: Route = { name: "settings", section: "items" };

it("uses a new tab and passes active route state before revealing it", async () => {
  const { workspace, host } = routeFixture();
  await openRoute(workspace, settings);
  const leaf = host.getLeavesOfType(SHELL_VIEW_TYPE)[0];
  try {
    expect(host.leafRequests).toEqual([true]);
    expect(host.revealedLeaves).toEqual([leaf]);
    expect(leaf?.viewStates).toEqual([
      { type: SHELL_VIEW_TYPE, active: true, state: { route: settings } },
    ]);
  } finally {
    await leaf?.detach();
  }
});

it("reuses the first plugin tab and changes state only when a route is given", async () => {
  const { workspace, host } = routeFixture();
  await openRoute(workspace);
  const leaf = host.getLeavesOfType(SHELL_VIEW_TYPE)[0];
  try {
    expect(leaf?.viewStates).toEqual([
      { type: SHELL_VIEW_TYPE, active: true, state: { route: undefined } },
    ]);
    await openRoute(workspace);
    expect(leaf?.viewStates).toHaveLength(1);
    await openRoute(workspace, settings);
    expect(leaf?.viewStates.at(-1)).toEqual({
      type: SHELL_VIEW_TYPE,
      active: true,
      state: { route: settings },
    });
    expect(host.leafRequests).toEqual([true]);
    expect(host.revealedLeaves).toEqual([leaf, leaf, leaf]);
  } finally {
    await leaf?.detach();
  }
});
