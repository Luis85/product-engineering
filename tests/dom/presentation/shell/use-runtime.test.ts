import { expect, expectTypeOf, it } from "vitest";
import { createApp } from "vue";
import type { VaultReadError } from "../../../../src/application/shell";
import { useMessages, useQuery } from "../../../../src/presentation/shell";
import { useRuntime } from "../../../../src/presentation/shell/runtime/use-runtime";
import type {
  RunOutcome,
  UseCase,
  UseCaseFn,
} from "../../../../src/presentation/shell/runtime/use-runtime";
import { mountComposable } from "../../../support/composable";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

it("injects the runtime and its plain catalog when a component mounts", async () => {
  const fixture = testRuntime({ language: "de" });
  const mounted = mountComposable(fixture.runtime, () => [useRuntime(), useMessages()] as const);
  try {
    expect(mounted.result[0]).toBe(fixture.runtime);
    expect(mounted.result[1].shell.language).toBe("de");
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("requires runtime provisioning", () => {
  const app = createApp({});
  expect(() => app.runWithContext(useRuntime)).toThrow(/runtime/i);
});

it("clears stale state on run and presents expected failures in the load's language", async () => {
  const fixture = testRuntime();
  const read: UseCaseFn<[], number, VaultReadError> = () => fixture.source.read;
  const mounted = mountComposable(fixture.runtime, () => useQuery(read));
  const query = mounted.result;
  expectTypeOf(query).toEqualTypeOf<UseCase<[], number, VaultReadError>>();
  expectTypeOf<ReturnType<typeof query.run>>().toEqualTypeOf<
    Promise<RunOutcome<number, VaultReadError>>
  >();
  try {
    await expect(query.run()).resolves.toEqual({ _tag: "success", value: 3 });
    expect(query.value.value).toBe(3);

    fixture.source.hold();
    fixture.source.set("fail");
    const failure = query.run();
    expect(query.pending.value).toBe(true);
    expect(query.value.value).toBeUndefined();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    fixture.source.release();
    await expect(failure).resolves.toMatchObject({
      _tag: "failure",
      error: { _tag: "VaultReadError" },
      message: { title: "Der Vault konnte nicht gelesen werden" },
    });
    expect(query.error.value?._tag).toBe("VaultReadError");
    expect(query.message.value?.title).toBe("Der Vault konnte nicht gelesen werden");
    expect(query.pending.value).toBe(false);
    expect(fixture.notifier).toEqual([]);

    fixture.source.set(7);
    const retry = query.run();
    expect(query.error.value).toBeUndefined();
    expect(query.message.value).toBeUndefined();
    await expect(retry).resolves.toEqual({ _tag: "success", value: 7 });
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("interrupts a superseded query and publishes only the latest result", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () => useQuery(() => fixture.source.read));
  const query = mounted.result;
  try {
    fixture.source.hold();
    const previous = query.run();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    const latest = query.run();
    await expect(previous).resolves.toEqual({ _tag: "interrupted" });
    expect(query.pending.value).toBe(true);

    fixture.source.set(9);
    fixture.source.release();
    await expect(latest).resolves.toEqual({ _tag: "success", value: 9 });
    expect(query.value.value).toBe(9);
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("interrupts a pending query when its scope closes", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () => useQuery(() => fixture.source.read));
  try {
    fixture.source.hold();
    const pending = mounted.result.run();
    await eventually(() => expect(fixture.source.held()).toBe(1));
    mounted.close();
    await expect(pending).resolves.toEqual({ _tag: "interrupted" });
    expect(fixture.source.held()).toBe(0);
    expect(mounted.result.value.value).toBeUndefined();
    expect(fixture.notifier).toEqual([]);
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("reports an effect-construction defect once and leaves typed state empty", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () =>
    useQuery(() => {
      throw new Error("private construction failure");
    }),
  );
  try {
    await expect(mounted.result.run()).resolves.toEqual({ _tag: "defect" });
    expect(fixture.notifier).toHaveLength(1);
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
    expect(mounted.result.error.value).toBeUndefined();
    expect(mounted.result.message.value).toBeUndefined();
  } finally {
    mounted.close();
    await fixture.runtime.dispose();
  }
});

it("reports one defect when a later query runs after runtime disposal", async () => {
  const fixture = testRuntime();
  const mounted = mountComposable(fixture.runtime, () => useQuery(() => fixture.source.read));
  try {
    await fixture.runtime.dispose();
    await expect(mounted.result.run()).resolves.toEqual({ _tag: "defect" });
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
    expect(fixture.notifier).toHaveLength(1);
  } finally {
    mounted.close();
  }
});
