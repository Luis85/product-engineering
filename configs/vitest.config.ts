process.env.TZ = "UTC";

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));

export const testAlias = {
  "@test/obsidian": fileURLToPath(new URL("../tests/support/obsidian/index.ts", import.meta.url)),
};

export function obsidianGuard() {
  const virtualId = "\0obsidian-test-guard";
  return {
    name: "obsidian-test-guard",
    enforce: "pre" as const,
    resolveId(id: string) {
      return id === "obsidian" ? virtualId : null;
    },
    load(id: string) {
      if (id === virtualId) {
        return 'throw new Error(\'OBSIDIAN_REQUIRES_TEST_DOUBLE: add vi.mock("obsidian", () => import("@test/obsidian"))\');';
      }
      return null;
    },
  };
}

export default defineConfig({
  root: ROOT,
  plugins: [obsidianGuard()],
  resolve: { alias: testAlias },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/main.ts", "src/styles/**", "src/env.d.ts"],
      reporter: ["text", "html", "cobertura"],
      reportsDirectory: "reports/coverage",
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
    reporters: process.env.CI
      ? ["default", ["junit", { outputFile: "reports/junit.xml" }]]
      : ["default"],
  },
});
