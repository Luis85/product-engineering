import { DEFAULT_SETTINGS } from "../../../../src/domain/shell";
import { Effect, Stream } from "effect";
import { expect, it } from "vitest";
import { h } from "vue";
import { setLogLevel, SettingsService } from "../../../../src/application/shell";
import { useSettings, useSettingsStatus, useStream } from "../../../../src/presentation/shell";
import { mountComposable } from "../../../support/composable";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

it("has a value on the first render and releases the stream on scope disposal", async () => {
  const fixture = testRuntime();
  fixture.source.hold();
  const mounted = mountComposable(
    fixture.runtime,
    () => useStream(Effect.succeed(2), Stream.fromEffect(fixture.source.read)),
    (value) => h("span", String(value.value)),
  );
  try {
    expect(mounted.root.textContent).toBe("2");
    await eventually(() => expect(fixture.source.held()).toBe(1));
    mounted.close();
    await eventually(() => expect(fixture.source.held()).toBe(0));
    fixture.source.release();
    expect(mounted.result.value).toBe(2);
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("reports one stream defect and retains the last value", async () => {
  const fixture = testRuntime();
  const changes = Stream.concat(
    Stream.fromEffect(fixture.source.read),
    Stream.die(new Error("private")),
  );
  const mounted = mountComposable(fixture.runtime, () => useStream(Effect.succeed(2), changes));
  try {
    await eventually(() => expect(fixture.notifier).toHaveLength(1));
    expect(mounted.result.value).toBe(3);
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("streams settings values and their read-only status", async () => {
  const fixture = testRuntime({ initialSettings: { logLevel: "warn" } });
  const mounted = mountComposable(fixture.runtime, () => ({
    settings: useSettings(),
    status: useSettingsStatus(),
  }));
  try {
    expect(mounted.result.settings.value).toEqual({ ...DEFAULT_SETTINGS, logLevel: "warn" });
    expect(mounted.result.status.value.writable).toBe(true);
    await fixture.runtime.runPromise(setLogLevel("debug"));
    await eventually(() =>
      expect(mounted.result.settings.value).toEqual({ ...DEFAULT_SETTINGS, logLevel: "debug" }),
    );

    fixture.store.writeExternally({ schemaVersion: 3 });
    await fixture.runtime.runPromise(SettingsService.use((service) => service.reload));
    await eventually(() =>
      expect(mounted.result.status.value).toMatchObject({
        writable: false,
        readOnlyReason: "newer-version",
      }),
    );
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});
