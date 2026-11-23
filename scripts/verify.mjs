// @ts-check
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const STEPS = [
  "format:check",
  "lint",
  "typecheck",
  "test:coverage",
  "analyze",
  "build",
  "check:dist",
];
export const FULL_STEPS = [...STEPS, "test:mutation"];

/**
 * @typedef {{step: string, status: "ok" | "FAIL", seconds: number}
 *   | {step: string, status: "not run"}} StepResult
 * @typedef {(command: string, args: string[], options: import("node:child_process").SpawnSyncOptions)
 *   => Pick<import("node:child_process").SpawnSyncReturns<Buffer>, "status" | "error">} Spawn
 */

/** @param {readonly string[]} steps @param {Spawn} spawn */
export function runSteps(steps, spawn = spawnSync) {
  /** @type {StepResult[]} */
  const results = [];
  let code = 0;

  for (const step of steps) {
    if (code !== 0) {
      results.push({ step, status: "not run" });
      continue;
    }
    const start = performance.now();
    const result = spawn("npm", ["run", step], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    code = result.error ? 1 : (result.status ?? 1);
    results.push({
      step,
      status: code === 0 ? "ok" : "FAIL",
      seconds: (performance.now() - start) / 1000,
    });
  }

  return { code, steps: results };
}

/** @param {readonly StepResult[]} steps */
export function summary(steps) {
  return steps
    .map((step) =>
      step.status === "not run"
        ? `not run ${step.step}`
        : `${step.status} ${step.step} ${step.seconds.toFixed(2)}s`,
    )
    .join("\n");
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const result = runSteps(process.argv.includes("--full") ? FULL_STEPS : STEPS);
  console.log(summary(result.steps));
  process.exitCode = result.code;
}
