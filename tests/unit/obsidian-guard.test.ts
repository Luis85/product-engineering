import { expect, it } from "vitest";
import { obsidianGuard, testAlias } from "../../configs/vitest.config";

it("requires a test double for Obsidian imports", async () => {
  await expect(import("obsidian")).rejects.toThrow("OBSIDIAN_REQUIRES_TEST_DOUBLE");
});

it("leaves aliases and other imports to the normal resolver", () => {
  const guard = obsidianGuard();
  expect(guard.resolveId("@test/obsidian")).toBeNull();
  expect(guard.load("node:fs")).toBeNull();
  expect(testAlias["@test/obsidian"]).toMatch(/tests[\\/]support[\\/]obsidian[\\/]index\.ts$/);
});

it("resolves the test double by its alias", async () => {
  const { Plugin } = await import("@test/obsidian");
  expect(typeof Plugin).toBe("function");
});
