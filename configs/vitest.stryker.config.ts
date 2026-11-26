import { defineConfig } from "vitest/config";
import { obsidianGuard, ROOT, testAlias } from "./vitest.config.ts";

export default defineConfig({
  root: ROOT,
  plugins: [obsidianGuard()],
  resolve: { alias: testAlias },
  test: {
    include: ["tests/unit/domain/**/*.test.ts", "tests/unit/application/**/*.test.ts"],
    environment: "node",
  },
});
