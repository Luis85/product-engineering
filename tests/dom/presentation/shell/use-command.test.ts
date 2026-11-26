import { Effect } from "effect";
import { expect, it } from "vitest";
import { useCommand } from "../../../../src/presentation/shell";
import { mountComposable } from "../../../support/composable";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

it("shares the pending promise and lets the write complete after unmount", async () => {
  const fixture = testRuntime();
  const writes: number[] = [];
  const mounted = mountComposable(fixture.runtime, () =>
    useCommand((input: number) =>
      Effect.tap(fixture.source.read, () =>
        Effect.sync(() => {
          writes.push(input);
        }),
      ),
    ),
  );

  try {
    fixture.source.hold();
    const write = mounted.result.run(1);
    expect(mounted.result.pending.value).toBe(true);
    await eventually(() => expect(fixture.source.held()).toBe(1));
    expect(mounted.result.run(2)).toBe(write);

    mounted.close();
    expect(fixture.source.held()).toBe(1);
    fixture.source.release();
    await expect(write).resolves.toEqual({ _tag: "success", value: 3 });
    expect(writes).toEqual([1]);
    expect(mounted.result.value.value).toBeUndefined();
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("notifies once when an unmounted command has an expected failure", async () => {
  const fixture = testRuntime({ source: "fail" });
  const mounted = mountComposable(fixture.runtime, () => useCommand(() => fixture.source.read));
  try {
    fixture.source.hold();
    const write = mounted.result.run();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    mounted.close();
    fixture.source.release();
    await expect(write).resolves.toMatchObject({
      _tag: "failure",
      error: { _tag: "VaultReadError" },
    });
    expect(fixture.notifier).toMatchObject([{ title: "Der Vault konnte nicht gelesen werden" }]);
    expect(fixture.logger).toEqual([]);
    expect(mounted.result.error.value).toBeUndefined();
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("reports a command defect once after the initiating scope has closed", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () =>
    useCommand(() =>
      Effect.andThen(fixture.source.read, Effect.die(new Error("private write defect"))),
    ),
  );
  try {
    fixture.source.hold();
    const write = mounted.result.run();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    mounted.close();
    fixture.source.release();
    await expect(write).resolves.toEqual({ _tag: "defect" });
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
    expect(fixture.notifier).toHaveLength(1);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("still allows runtime disposal to interrupt an in-flight write", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () => useCommand(() => fixture.source.read));
  try {
    fixture.source.hold();
    const write = mounted.result.run();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    await fixture.runtime.dispose();
    await expect(write).resolves.toEqual({ _tag: "interrupted" });
    expect(fixture.source.held()).toBe(0);
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
  }
});

it("leaves expected failures in the active command state without notifying", async () => {
  const fixture = testRuntime({ source: "fail" });
  const mounted = mountComposable(fixture.runtime, () => useCommand(() => fixture.source.read));
  try {
    await expect(mounted.result.run()).resolves.toMatchObject({ _tag: "failure" });
    expect(mounted.result.error.value?._tag).toBe("VaultReadError");
    expect(mounted.result.message.value?.title).toBe("Der Vault konnte nicht gelesen werden");
    expect(mounted.result.pending.value).toBe(false);
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});
