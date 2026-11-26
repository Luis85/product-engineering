import { expect, it, vi } from "vitest";

it("requires a test double for Obsidian imports in the dom project", async () => {
  await expect(import("obsidian")).rejects.toThrow("OBSIDIAN_REQUIRES_TEST_DOUBLE");
});

it("loads the test double through its alias in the dom project", async () => {
  vi.resetModules();
  vi.doMock("obsidian", () => import("@test/obsidian"));
  try {
    const { Plugin } = await import("obsidian");
    const double = await import("@test/obsidian");
    expect(Plugin).toBe(double.Plugin);
    expect(typeof document.body.createDiv).toBe("function");
  } finally {
    vi.doUnmock("obsidian");
  }
});
