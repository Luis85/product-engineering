import { expect, it } from "vitest";
import { releaseAll } from "../../../../src/presentation/shell/host";

it("releases a snapshot of the callbacks in reverse order", () => {
  const calls: string[] = [];
  const releases = new Set<() => void>();
  releases.add(() => calls.push("first"));
  releases.add(() => {
    calls.push("last");
    releases.clear();
  });

  releaseAll(releases);
  expect(calls).toEqual(["last", "first"]);
});

it("finishes cleanup and rethrows the first failure in release order", () => {
  const calls: string[] = [];
  const first = new Error("first release failure");
  const second = new Error("second release failure");

  expect(() =>
    releaseAll([
      () => calls.push("finished"),
      () => {
        throw second;
      },
      () => {
        throw first;
      },
    ]),
  ).toThrow(first);
  expect(calls).toEqual(["finished"]);
});
