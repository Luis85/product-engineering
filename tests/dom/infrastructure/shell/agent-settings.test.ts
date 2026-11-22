import { get } from "node:http";
import { Plugin } from "obsidian";
import type { SettingDefinitionAction, SettingDefinitionItem } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin, settingsIn, TextComponent } from "@test/obsidian";
import type { LocalMcpConnection, McpController } from "../../../../src/application/integrations";
import { catalogFor } from "../../../../src/application/messages";
import { createAgentSettingsPart } from "../../../../src/infrastructure/obsidian/integrations";
import { mirrorSettings, ShellSettingTab } from "../../../../src/infrastructure/obsidian/shell";
import ShellPlugin from "../../../../src/main";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

vi.mock("obsidian", () => import("@test/obsidian"));

class TestPlugin extends Plugin {}

function activate(definitions: readonly SettingDefinitionItem[], name: string): void {
  const action = definitions.find(
    (item): item is SettingDefinitionAction =>
      "action" in item && typeof item.action === "function" && item.name === name,
  );
  if (!action) throw new Error(`Missing native action ${name}`);
  action.action(document.createElement("div"), 0);
}

async function harness(initialSettings?: unknown) {
  const fixture = testRuntime({ language: "en", initialSettings });
  const mirror = await mirrorSettings(fixture.runtime);
  const { plugin } = createTestPlugin(TestPlugin);
  let connection: LocalMcpConnection | undefined;
  const controller = {
    start: vi.fn<McpController["start"]>((port) => {
      connection = {
        endpoint: `http://127.0.0.1:${port || 49123}/mcp`,
        token: "test-connection-token",
      };
      return Promise.resolve(connection);
    }),
    stop: vi.fn<McpController["stop"]>(() => {
      connection = undefined;
      return Promise.resolve();
    }),
    status: (): ReturnType<McpController["status"]> =>
      connection ? { state: "running", endpoint: connection.endpoint } : { state: "stopped" },
    connection: () => connection,
    dispose: () => Promise.resolve(),
  };
  const catalog = catalogFor("en");
  const part = createAgentSettingsPart({
    controller,
    runtime: fixture.runtime,
    mirror,
    messages: catalog,
    selectedItemIds: () => ["shared-item"],
  });
  const tab = new ShellSettingTab(plugin.app, plugin, fixture.runtime, mirror, catalog.shell, part);
  return {
    fixture,
    tab,
    controller,
    dispose: async () => {
      await mirror.stop();
      await fixture.runtime.dispose();
    },
  };
}

it("persists port and provider paths from native settings and clears blank values", async () => {
  const { tab, fixture, dispose } = await harness();
  try {
    await tab.setControlValue("mcpPort", " 8411 ");
    await tab.setControlValue("claudeCodePath", "/tools/claude");
    await tab.setControlValue("codexPath", "C:\\Tools\\codex.exe");
    expect(tab.getControlValue("mcpPort")).toBe("8411");
    expect(fixture.store.saved.at(-1)).toEqual({
      schemaVersion: 1,
      logLevel: "warn",
      mcpPort: 8411,
      claudeCodePath: "/tools/claude",
      codexPath: "C:\\Tools\\codex.exe",
    });
    await tab.setControlValue("claudeCodePath", "");
    await tab.setControlValue("mcpPort", "");
    expect(tab.getControlValue("mcpPort")).toBe("");
    expect(tab.getControlValue("claudeCodePath")).toBe("");
    expect(fixture.store.saved.at(-1)).toEqual({
      schemaVersion: 1,
      logLevel: "warn",
      codexPath: "C:\\Tools\\codex.exe",
    });
  } finally {
    await dispose();
  }
});

it("starts and stops on demand and copies credentials only from the native copy action", async () => {
  const { tab, fixture, controller, dispose } = await harness({ mcpPort: 8391 });
  try {
    expect(controller.start).not.toHaveBeenCalled();
    expect(fixture.clipboard).toHaveLength(0);
    activate(tab.getSettingDefinitions(), "Start MCP server");
    await eventually(() =>
      expect(controller.start).toHaveBeenCalledExactlyOnceWith(8391, ["shared-item"]),
    );
    await eventually(() => expect(controller.status()).toMatchObject({ state: "running" }));
    expect(fixture.clipboard).toHaveLength(0);

    activate(tab.getSettingDefinitions(), "Copy MCP connection");
    await eventually(() => expect(fixture.clipboard).toHaveLength(1));
    expect(fixture.clipboard[0]).toContain("http://127.0.0.1:8391/mcp");
    expect(fixture.clipboard[0]).toContain("test-connection-token");
    expect(JSON.stringify(fixture.notifier)).not.toContain("test-connection-token");

    activate(tab.getSettingDefinitions(), "Stop MCP server");
    await eventually(() => expect(controller.status()).toEqual({ state: "stopped" }));
    expect(controller.stop).toHaveBeenCalledOnce();
  } finally {
    await dispose();
  }
});

it("keeps an executable path input focused while its value is saved", async () => {
  const { tab, fixture, dispose } = await harness();
  document.body.append(tab.containerEl);
  try {
    tab.update();
    const control = settingsIn(tab).get("codexPath")?.control;
    if (!(control instanceof TextComponent)) throw new Error("Codex path input is missing");

    control.inputEl.focus();
    control.inputEl.value = "C:\\Tools\\codex.exe";
    control.inputEl.dispatchEvent(new Event("input"));
    await control.pending;

    expect(fixture.store.saved.at(-1)).toMatchObject({ codexPath: "C:\\Tools\\codex.exe" });
    expect(settingsIn(tab).get("codexPath")?.control).toBe(control);
    expect(document.activeElement).toBe(control.inputEl);
  } finally {
    tab.containerEl.remove();
    await dispose();
  }
});
function responseStatus(endpoint: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const request = get(endpoint, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", reject);
  });
}

it("closes the actual listener when the plugin is unloaded", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  const { integrations } = catalogFor("de");
  let endpoint: string;
  try {
    await registry.load();
    const tab = registry.settingTabs[0];
    if (!tab) throw new Error("Native settings are missing");
    activate(tab.getSettingDefinitions(), integrations.settings.mcp.start);
    endpoint = await eventually(() => {
      const status = tab
        .getSettingDefinitions()
        .find((item) => "name" in item && item.name === integrations.settings.mcp.title);
      const description = status && "desc" in status ? status.desc : undefined;
      const url =
        typeof description === "string"
          ? /http:\/\/127\.0\.0\.1:\d+\/mcp/.exec(description)?.[0]
          : undefined;
      if (!url) throw new Error("Expected the running MCP endpoint");
      return url;
    });
    await expect(responseStatus(endpoint)).resolves.toBe(401);
  } finally {
    plugin.unload();
  }
  await eventually(async () => {
    await expect(responseStatus(endpoint)).rejects.toMatchObject({ code: "ECONNREFUSED" });
  });
});
