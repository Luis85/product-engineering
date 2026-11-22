import { eventually } from "../../../support/wait";
import { Effect } from "effect";
import { Plugin } from "obsidian";
import { afterEach, expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { appCommands } from "../../../../src/application/commands";
import type { AppCommand } from "../../../../src/application/commands";
import { catalogFor } from "../../../../src/application/messages";
import type { Route } from "../../../../src/application/routes";
import { registerCommands } from "../../../../src/infrastructure/obsidian/shell";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));
afterEach(() => vi.restoreAllMocks());

class TestPlugin extends Plugin {}

it("registers localized commands without hotkeys and opens the requested view", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const { runtime } = testRuntime();
  const open = vi.fn<(route?: Route) => Promise<unknown>>().mockResolvedValue(undefined);
  try {
    const undo = registerCommands(plugin, runtime, appCommands, catalogFor("en"), open);
    expect([...registry.commands.values()].map(({ name, hotkeys }) => [name, hotkeys])).toEqual([
      ["Open Product Engineering", undefined],
      ["Copy diagnostics", undefined],
    ]);
    registry.runCommand("product-engineering:open-view");
    await eventually(() => expect(open).toHaveBeenCalledExactlyOnceWith(undefined));
    undo();
    expect(registry.commands.size).toBe(0);
  } finally {
    await runtime.dispose();
  }
});

it("handles defects in a run action and executes the next action", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const fixture = testRuntime();
  const next = vi.fn<() => void>();
  const commands: readonly AppCommand[] = [
    {
      id: "failed",
      name: () => "Failed",
      action: { _tag: "run", effect: Effect.die(new Error("hidden")) },
    },
    { id: "next", name: () => "Next", action: { _tag: "run", effect: Effect.sync(next) } },
  ];
  try {
    registerCommands(plugin, fixture.runtime, commands, catalogFor("en"), () => Promise.resolve());
    registry.runCommand("product-engineering:failed");
    await eventually(() => expect(fixture.notifier).toHaveLength(1));
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
    registry.runCommand("product-engineering:next");
    await eventually(() => expect(next).toHaveBeenCalledOnce());
  } finally {
    await fixture.runtime.dispose();
  }
});

it("undoes earlier commands and the partially registered command when the host throws", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const { runtime } = testRuntime();
  const addCommand = plugin.addCommand.bind(plugin);
  let attempts = 0;
  vi.spyOn(plugin, "addCommand").mockImplementation((command) => {
    attempts += 1;
    if (attempts === 2) registry.failNextAddCommand({ after: true });
    return addCommand(command);
  });
  try {
    expect(() =>
      registerCommands(plugin, runtime, appCommands, catalogFor("en"), () => Promise.resolve()),
    ).toThrow("Test addCommand failed after registration");
    expect(registry.commands.size).toBe(0);
  } finally {
    await runtime.dispose();
  }
});
