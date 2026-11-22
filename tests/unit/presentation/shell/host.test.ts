import { expect, expectTypeOf, it, vi } from "vitest";
import { loadSurface, releaseAll } from "../../../../src/presentation/shell/host";
import type { SurfaceLoader } from "../../../../src/presentation/shell/host";

vi.mock("vue", () => {
  throw new Error("The host entry evaluated Vue");
});

vi.mock("../../../../src/presentation/shell/mount", () => {
  throw new Error("The host entry evaluated the Vue mount module");
});

it("exposes a loader and teardown without evaluating the Vue surface", () => {
  expect(loadSurface).toEqual(expect.any(Function));
  expect(releaseAll).toEqual(expect.any(Function));
  expectTypeOf(loadSurface).toEqualTypeOf<SurfaceLoader>();
});
