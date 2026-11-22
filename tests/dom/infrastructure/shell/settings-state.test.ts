import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { SHELL_VIEW_TYPE, ShellView } from "../../../../src/infrastructure/obsidian/shell";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { testSurface } from "../../../support/surface";
import { eventually } from "../../../support/wait";

vi.mock("obsidian", () => import("@test/obsidian"));

await preloadSurface();

class SettingsViewPlugin extends Plugin {}

it.each([
  ["one", "First section"],
  ["two", "Second section"],
] as const)("restores the %s section and renders only that section", async (section, text) => {
  const { plugin, registry } = createTestPlugin(SettingsViewPlugin);
  const { runtime } = testRuntime();
  const surface = testSurface();
  const surfaces = new Set<() => void>();
  plugin.registerView(SHELL_VIEW_TYPE, (leaf) => new ShellView(leaf, runtime, surfaces, surface));
  const leaf = registry.plugin.app.workspace.getLeaf(true);
  const route = { name: "settings", section };

  try {
    await leaf.setViewState({ type: SHELL_VIEW_TYPE, state: { route } });
    const view = leaf.view;
    if (!view) throw new Error("Restored settings view is missing");
    await eventually(() => {
      const screen = view.contentEl.querySelector('[data-testid="settings-screen"]');
      expect(screen?.querySelector(`[data-testid="section-${section}"]`)?.textContent).toBe(text);
    });
    expect(view.getState().route).toEqual(route);
    expect(view.contentEl.querySelector('[data-testid="frame-history"]')).toBeNull();
  } finally {
    await leaf.detach();
    await runtime.dispose();
  }
});
