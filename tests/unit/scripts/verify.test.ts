import { describe, expect, it, vi } from "vitest";
import { FULL_STEPS, runSteps, STEPS, summary } from "../../../scripts/verify.mjs";

type Spawn = NonNullable<Parameters<typeof runSteps>[1]>;

describe("verification gate", () => {
  it("adds the gated mutation run to full verification", () => {
    expect(FULL_STEPS).toEqual([...STEPS, "test:mutation"]);
  });

  it("runs every step in order when they pass", () => {
    const spawn = vi.fn<Spawn>(() => ({ status: 0 }));
    const result = runSteps(STEPS, spawn);

    expect(STEPS).toEqual([
      "format:check",
      "lint",
      "typecheck",
      "test:coverage",
      "analyze",
      "build",
      "check:dist",
      "check:notices",
    ]);
    expect(spawn.mock.calls).toEqual(
      STEPS.map((step) => [
        "npm",
        ["run", step],
        { stdio: "inherit", shell: process.platform === "win32" },
      ]),
    );
    expect(result.code).toBe(0);
    expect(result.steps.map(({ status }) => status)).toEqual(STEPS.map(() => "ok"));
  });

  it("reports the failed step and leaves later steps untouched", () => {
    const spawn = vi
      .fn<Spawn>()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 7 });
    const result = runSteps(STEPS, spawn);

    expect(result.code).toBe(7);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(summary(result.steps)).toMatch(
      /ok\s+format:check\s+[\d.]+s\r?\nFAIL\s+lint\s+[\d.]+s\r?\nnot run\s+typecheck\r?\nnot run\s+test:coverage\r?\nnot run\s+analyze\r?\nnot run\s+build\r?\nnot run\s+check:dist\r?\nnot run\s+check:notices/,
    );
  });

  it("returns code 1 if npm cannot start", () => {
    const result = runSteps(STEPS, () => ({ status: null, error: new Error("spawn failed") }));

    expect(result.code).toBe(1);
    expect(result.steps[0]?.status).toBe("FAIL");
  });
});
