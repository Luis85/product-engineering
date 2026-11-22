import { Effect } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { setLogLevel, SettingsService } from "../../../src/application/shell";
import { appLayer } from "../../../src/infrastructure/obsidian/app-layer";
import { makeRuntime } from "../../../src/infrastructure/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

it("builds the Obsidian runtime lazily, runs a shell use case and disposes it", async () => {
  const { plugin, registry } = createTestPlugin(class extends Plugin {});
  const load = vi.spyOn(plugin, "loadData");
  const runtime = makeRuntime(appLayer(plugin, { language: "de", developmentMode: false }));
  expect(load).not.toHaveBeenCalled();
  try {
    await runtime.runPromise(setLogLevel("debug"));
    expect(load).toHaveBeenCalledOnce();
    expect(registry.saved).toEqual([{ schemaVersion: 1, logLevel: "debug" }]);
    await expect(
      runtime.runPromise(Effect.flatMap(SettingsService, (settings) => settings.current)),
    ).resolves.toEqual({ logLevel: "debug" });
  } finally {
    await runtime.dispose();
  }
  await expect(runtime.runPromise(Effect.void)).rejects.toThrow("ManagedRuntime disposed");
});
