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

// oxlint-disable-next-line vitest/warn-todo -- Task 04 adds the aliased test double this case needs.
it.todo("resolves the test double by its alias");
