import { expect, it } from "vitest";

it("requires a test double for Obsidian imports", async () => {
  await expect(import("obsidian")).rejects.toThrow("OBSIDIAN_REQUIRES_TEST_DOUBLE");
});

// oxlint-disable-next-line vitest/warn-todo -- Task 04 adds the aliased test double this case needs.
it.todo("resolves the test double by its alias");
