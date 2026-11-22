import { Effect } from "effect";
import { expect, it } from "vitest";
import { runSafely } from "../../../../src/infrastructure/obsidian/shell/run";
import { testRuntime } from "../../../support/runtime";

it("returns the successful value and handles interruption silently", async () => {
  const fixture = testRuntime();
  try {
    await expect(runSafely(fixture.runtime, Effect.succeed(7))).resolves.toBe(7);
    await expect(runSafely(fixture.runtime, Effect.interrupt)).resolves.toBeUndefined();
    expect(fixture.notifier).toEqual([]);
    expect(fixture.logger).toEqual([]);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("reports one unexpected failure and never rethrows it", async () => {
  const fixture = testRuntime();
  try {
    await expect(
      runSafely(fixture.runtime, Effect.die(new Error("private cause"))),
    ).resolves.toBeUndefined();
    expect(fixture.notifier).toHaveLength(1);
    expect(fixture.notifier[0]?.detail).toContain("T-1");
    expect(fixture.logger).toMatchObject([{ event: "defect.reported", incidentId: "T-1" }]);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("also resolves after runtime disposal", async () => {
  const { runtime } = testRuntime();
  await runtime.dispose();
  await expect(runSafely(runtime, Effect.succeed(7))).resolves.toBeUndefined();
});
