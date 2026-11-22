import { expect, it } from "vitest";
import { toLoggedError } from "../../../../src/application/shell";

it("records only code names and basenames from supported stack frames", () => {
  const cause = new TypeError("private details");
  cause.stack = [
    "TypeError: private details",
    "    at run.handle (C:\\Private Folder\\main.js:21:4)",
    "    at /vault/private/lib.js:5:3",
    "mount@file:///home/me/app.js:9:2",
    "    at odd function (/home/me/last.js:7:3)",
    "unrecognized text",
  ].join("\n");

  expect(toLoggedError(cause)).toMatchObject({
    name: "TypeError",
    message: "private details",
    frames: ["run.handle main.js:21:4", "lib.js:5:3", "mount app.js:9:2", "last.js:7:3"],
  });
});

it("limits frames, falls back on invalid names, and handles non-Errors", () => {
  const cause = new Error("details");
  cause.name = "/private/path";
  cause.stack = Array.from(
    { length: 12 },
    (_, i) => `at example (/private/file.js:${i + 1}:1)`,
  ).join("\n");
  const logged = toLoggedError(cause);

  expect(logged.name).toBe("Error");
  expect(logged.frames).toHaveLength(10);
  expect(toLoggedError("private payload")).toMatchObject({
    name: "NonError",
    message: "private payload",
    frames: [],
  });
});
