import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { SHELL_VIEW_TYPE, ShellView } from "../../../../src/infrastructure/obsidian/shell";
import { appSurface } from "../../../../src/presentation/app-surface";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { testSurface } from "../../../support/surface";
import { eventually } from "../../../support/wait";

vi.mock("obsidian", () => import("@test/obsidian"));

await preloadSurface();

class ViewPlugin extends Plugin {}

function viewFixture() {
  const { plugin, registry } = createTestPlugin(ViewPlugin);
  const { runtime } = testRuntime();
  const surfaces = new Set<() => void>();
  const surface = testSurface();
  plugin.registerView(SHELL_VIEW_TYPE, (leaf) => new ShellView(leaf, runtime, surfaces, surface));
  return { workspace: registry.plugin.app.workspace, runtime };
}

it("restores the first saved route as the history start and preserves the base view state", async () => {
  const { workspace, runtime } = viewFixture();
  const leaf = workspace.getLeaf(true);
  const initial = { name: "item", id: "restored" };
  try {
    await leaf.setViewState({ type: SHELL_VIEW_TYPE, state: { route: initial, extra: 7 } });
    const view = leaf.view;
    if (!view) throw new Error("Restored view is missing");
    await eventually(() =>
      expect(view.contentEl.querySelector('[data-testid="item"]')?.textContent).toBe("restored"),
    );
    expect(view.getState()).toEqual({ route: initial, extra: 7 });
    expect(view.contentEl.querySelector('[data-testid="frame-history"]')).toBeNull();
    expect(workspace.layoutSaves).toBe(1);

    await leaf.setViewState({ type: SHELL_VIEW_TYPE, state: { route: { name: "other" } } });
    const history = await eventually(() => {
      const toolbar = view.contentEl.querySelector('[data-testid="frame-history"]');
      if (!toolbar) throw new Error("History controls are missing");
      return toolbar;
    });
    expect(workspace.layoutSaves).toBe(2);
    history.querySelector("button")?.click();
    await eventually(() => expect(view.getState().route).toEqual(initial));
    expect(workspace.layoutSaves).toBe(3);
  } finally {
    await leaf.detach();
    await runtime.dispose();
  }
});

it("falls back for broken state and keeps each view's route independent", async () => {
  const { workspace, runtime } = viewFixture();
  const first = workspace.getLeaf(true);
  const second = workspace.getLeaf(true);
  try {
    await first.setViewState({ type: SHELL_VIEW_TYPE, state: { route: { name: "item" } } });
    await second.setViewState({ type: SHELL_VIEW_TYPE, state: { route: { name: "other" } } });
    expect(first.view?.getState().route).toEqual({ name: "home" });
    expect(second.view?.getState().route).toEqual({ name: "other" });
    expect(workspace.layoutSaves).toBe(1);

    const route = { name: "item", id: "current" };
    await first.setViewState({ type: SHELL_VIEW_TYPE, state: { route } });
    expect(first.view?.getState().route).toEqual(route);
    expect(second.view?.getState().route).toEqual({ name: "other" });
    expect(workspace.layoutSaves).toBe(2);
    await first.setViewState({ type: SHELL_VIEW_TYPE, state: { route: { ...route } } });
    expect(workspace.layoutSaves).toBe(2);
  } finally {
    await Promise.all([first.detach(), second.detach()]);
    await runtime.dispose();
  }
});

it("persists the collapsed rail in the leaf state and restores it for that leaf", async () => {
  const { plugin, registry } = createTestPlugin(ViewPlugin);
  const { runtime } = testRuntime({ language: "en" });
  const surfaces = new Set<() => void>();
  plugin.registerView(
    SHELL_VIEW_TYPE,
    (leaf) => new ShellView(leaf, runtime, surfaces, appSurface),
  );
  const initial = registry.plugin.app.workspace.getLeaf(true);
  const restored = registry.plugin.app.workspace.getLeaf(true);
  try {
    await initial.setViewState({ type: SHELL_VIEW_TYPE });
    const collapse = await eventually(() => {
      const control = initial.view?.contentEl.querySelector<HTMLButtonElement>(
        'button[aria-label="Collapse side navigation"]',
      );
      expect(control).toBeDefined();
      if (!control) throw new Error("Rail control is missing");
      return control;
    });
    collapse.click();
    const state = initial.view?.getState();
    expect(state).toMatchObject({ collapsedRail: true });
    await restored.setViewState({ type: SHELL_VIEW_TYPE, ...(state && { state }) });
    await eventually(() =>
      expect(
        restored.view?.contentEl.querySelector('button[aria-label="Expand side navigation"]'),
      ).not.toBeNull(),
    );
  } finally {
    await Promise.all([initial.detach(), restored.detach()]);
    await runtime.dispose();
  }
});
