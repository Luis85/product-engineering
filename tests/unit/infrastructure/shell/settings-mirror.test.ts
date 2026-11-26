import { DEFAULT_SETTINGS } from "../../../../src/domain/shell";
import { eventually } from "../../../support/wait";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { setLogLevel, SettingsService } from "../../../../src/application/shell";
import { mirrorSettings } from "../../../../src/infrastructure/obsidian/shell/settings-mirror";
import { testRuntime } from "../../../support/runtime";

it("keeps ordinary synchronous properties in sync with the settings service", async () => {
  const fixture = testRuntime({ initialSettings: { logLevel: "info" } });
  const mirror = await mirrorSettings(fixture.runtime);
  try {
    expect(mirror.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
    expect(mirror.status).toEqual({ writable: true, issues: [] });
    await fixture.runtime.runPromise(setLogLevel("debug"));
    await eventually(() =>
      expect(mirror.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "debug" }),
    );

    fixture.store.writeExternally({ schemaVersion: 3, logLevel: "error" });
    await fixture.runtime.runPromise(Effect.flatMap(SettingsService, (service) => service.reload));
    await mirror.refresh();
    expect(mirror.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "warn" });
    expect(mirror.status).toMatchObject({ writable: false, readOnlyReason: "newer-version" });
  } finally {
    await mirror.stop();
    await fixture.runtime.dispose();
  }
});

it("stops mirror subscriptions without stopping the application runtime", async () => {
  const fixture = testRuntime({ initialSettings: { logLevel: "info" } });
  const mirror = await mirrorSettings(fixture.runtime);
  try {
    await mirror.stop();
    await fixture.runtime.runPromise(setLogLevel("debug"));
    expect(mirror.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
    expect(fixture.store.saved).toEqual([{ schemaVersion: 1, logLevel: "debug" }]);
  } finally {
    await fixture.runtime.dispose();
  }
});
