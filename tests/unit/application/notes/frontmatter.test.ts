import { expect, it } from "vitest";
import { applyPatch } from "../../../../src/application/notes/patch";

it("keeps existing property order, removes keys and appends new keys", () => {
  const before = { schema: "example", title: "Start", discard: true, flags: ["a"] };
  const after = applyPatch(before, {
    remove: ["discard", "title", "missing"],
    set: { extra: false, title: "Changed" },
  });

  expect(after).toEqual({ schema: "example", title: "Changed", flags: ["a"], extra: false });
  expect(Object.keys(after)).toEqual(["schema", "title", "flags", "extra"]);
  expect(before).toEqual({ schema: "example", title: "Start", discard: true, flags: ["a"] });
});

it("handles property names that also belong to Object.prototype", () => {
  const before = Object.fromEntries([
    ["__proto__", "kept"],
    ["toString", "remove"],
  ]);
  const after = applyPatch(before, { remove: ["toString"], set: { constructor: "new" } });
  expect(Object.entries(after)).toEqual([
    ["__proto__", "kept"],
    ["constructor", "new"],
  ]);
});
