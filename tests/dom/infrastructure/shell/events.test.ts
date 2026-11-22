import { Effect, Layer } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { EventBus } from "../../../../src/application/shell";
import { hostEventsLayer } from "../../../../src/infrastructure/obsidian/shell";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

function hostedRuntime() {
  const { plugin, registry } = createTestPlugin(class extends Plugin {}, { layoutReady: false });
  const workspace = registry.plugin.app.workspace;
  const registration = vi.spyOn(workspace, "onLayoutReady");
  const fixture = testRuntime({ hostEvents: hostEventsLayer(plugin) });
  return { ...fixture, workspace, registration };
}

it("publishes layout readiness only once and ignores callbacks after disposal", async () => {
  const fixture = hostedRuntime();
  const bus = await fixture.runtime.runPromise(EventBus);
  const publish = vi.spyOn(bus, "publish");
  try {
    expect(publish).not.toHaveBeenCalled();
    expect(fixture.registration).toHaveBeenCalledOnce();
    fixture.workspace.markLayoutReady();
    fixture.registration.mock.calls[0]?.[0]();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({ _tag: "LayoutReady" });
  } finally {
    await fixture.runtime.dispose();
  }
  fixture.registration.mock.calls[0]?.[0]();
  expect(publish).toHaveBeenCalledTimes(1);
});

it("ignores a first layout callback after shutdown", async () => {
  const fixture = hostedRuntime();
  const bus = await fixture.runtime.runPromise(EventBus);
  const publish = vi.spyOn(bus, "publish");
  await fixture.runtime.dispose();
  fixture.workspace.markLayoutReady();
  expect(publish).not.toHaveBeenCalled();
});

it("reports a mapping or publication defect at the host boundary", async () => {
  const fixture = hostedRuntime();
  try {
    const bus = await fixture.runtime.runPromise(EventBus);
    vi.spyOn(bus, "publish").mockImplementationOnce(() => {
      throw new Error("host callback failed");
    });
    expect(() => fixture.workspace.markLayoutReady()).not.toThrow();
    expect(fixture.logger).toMatchObject([
      { level: "error", event: "defect.reported", incidentId: "T-1" },
    ]);
    expect(fixture.notifier).toHaveLength(1);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("can build a host without an event producer", async () => {
  const fixture = testRuntime({ hostEvents: Layer.empty });
  try {
    await expect(fixture.runtime.runPromise(Effect.void)).resolves.toBeUndefined();
  } finally {
    await fixture.runtime.dispose();
  }
});
