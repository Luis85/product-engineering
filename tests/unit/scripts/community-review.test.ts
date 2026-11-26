import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");

it("reserves strict npm engine enforcement for the hosted toolchain", () => {
  expect(read(".npmrc")).not.toMatch(/^engine-strict\s*=\s*true/m);
  for (const file of ["ci.yml", "release.yml", "nightly-mutation.yml"]) {
    expect(read(`.github/workflows/${file}`)).toContain("npm ci --engine-strict");
  }
});

it("publishes the three assets supported by the Obsidian updater", () => {
  const release = read(".github/workflows/release.yml");
  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    expect(release).toContain("release/product-engineering/" + file);
  }
  expect(release).not.toContain("release/THIRD-PARTY-NOTICES.txt");
});

it.each(["backlog", "copilot", "project-frame", "project-overview", "prototypes"])(
  "keeps the authored %s styles free of the reported compatibility patterns",
  (file) => {
    expect(read(`src/styles/${file}.css`)).not.toMatch(/:has\(|(?:clip-path|column-gap)\s*:/);
  },
);
