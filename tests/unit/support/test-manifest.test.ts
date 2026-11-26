import { expect, it } from "vitest";
import manifest from "../../../manifest.json";
import { TEST_MANIFEST } from "@test/obsidian";

it("keeps the test manifest's host-facing properties current", () => {
  expect(TEST_MANIFEST).toMatchObject({
    id: manifest.id,
    minAppVersion: manifest.minAppVersion,
    isDesktopOnly: manifest.isDesktopOnly,
  });
});
