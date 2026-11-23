import { defineConfig } from "vitest/config";
import baseline from "./vitest.config.ts";

export default defineConfig({
  ...baseline,
  test: {
    ...baseline.test,
    coverage: { enabled: false },
    reporters: ["default"],
    // The first DOM mount loads the instrumented presentation graph.
    testTimeout: 15_000,
  },
});
