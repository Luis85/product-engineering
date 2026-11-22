import { afterEach, expect, it, vi } from "vitest";
import { clearNotices, createTestPlugin, failNextNotice } from "@test/obsidian";
import ShellPlugin from "../../src/main";

vi.mock("obsidian", () => import("@test/obsidian"));

afterEach(() => {
  clearNotices();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function registrationCounts(
  registry: ReturnType<typeof createTestPlugin<ShellPlugin>>["registry"],
) {
  return [
    registry.commands.size,
    registry.views.size,
    registry.settingTabs.length,
    registry.ribbonIcons.size,
  ];
}

it("registers one shell on every load and removes its registrations on unload", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  try {
    await registry.load();

    expect([...registry.commands.keys()]).toEqual([
      "product-engineering:open-view",
      "product-engineering:copy-diagnostics",
    ]);
    expect([...registry.views.keys()]).toEqual(["product-engineering-view"]);
    expect(registrationCounts(registry)).toEqual([2, 1, 1, 1]);
    expect([...registry.ribbonIcons.keys()]).toEqual(["product-engineering:Product Engineering"]);

    registry.runCommand("product-engineering:open-view");
    const workspace = registry.plugin.app.workspace;
    await vi.waitFor(() =>
      expect(workspace.getLeavesOfType("product-engineering-view")).toHaveLength(1),
    );
    expect(workspace.getLeavesOfType("product-engineering-view")[0]?.view?.getDisplayText()).toBe(
      "Product Engineering",
    );

    plugin.unload();
    expect(registrationCounts(registry)).toEqual([0, 0, 0, 0]);

    await registry.load();
    expect(registrationCounts(registry)).toEqual([2, 1, 1, 1]);
  } finally {
    plugin.unload();
  }
  expect(registrationCounts(registry)).toEqual([0, 0, 0, 0]);
});

it("reports a command defect once and still runs the next command", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  try {
    await registry.load();
    failNextNotice();
    registry.runCommand("product-engineering:copy-diagnostics");
    await vi.waitFor(() => expect(registry.notices).toHaveLength(1));
    expect(registry.notices[0]).toMatch(/Product Engineering.*[0-9A-Z]{6}/s);
    expect(registry.notices[0]).not.toContain("Test notice failed");
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      "[product-engineering]",
      expect.objectContaining({
        event: "defect.reported",
        incidentId: expect.stringMatching(/^[0-9A-Z]{6}$/) as unknown,
      }),
    );

    registry.runCommand("product-engineering:copy-diagnostics");
    await vi.waitFor(() => expect(registry.notices).toHaveLength(2));
    expect(registry.notices[1]).toContain("Diagnose kopiert");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledOnce();
  } finally {
    plugin.unload();
  }
});

it("loads with read-only settings when the Obsidian data read fails", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  registry.setFailLoadData();
  try {
    await registry.load();
    expect(registrationCounts(registry)).toEqual([2, 1, 1, 1]);
    expect(registry.notices).toHaveLength(1);
    expect(registry.notices[0]).toContain("Einstellungen sind schreibgeschützt");
    expect(registry.saved).toEqual([]);
  } finally {
    plugin.unload();
  }
});
