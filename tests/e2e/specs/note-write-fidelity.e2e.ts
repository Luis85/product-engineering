import { browser, expect } from "@wdio/globals";
import * as fc from "fast-check";
import { it } from "mocha";
import { yamlEntry } from "../../../src/domain/notes";
import { WRITE_FACTS, yamlSampleValue } from "../../support/notes/fidelity";
import { installConsoleSpy, pluginProblems } from "../support";

const scalar = fc.oneof(fc.string(), fc.double(), fc.boolean(), fc.constant(null));
const sample = fc.oneof(scalar, fc.array(scalar, { maxLength: 8 }));
const special = [
  NaN,
  Infinity,
  -Infinity,
  -0,
  [NaN, Infinity, -Infinity, -0],
  "01067",
  "1.10",
  "12:30",
  "yes",
  "2026-11-22",
  "a\u0085b\u2028c\u2029d\ufeffe\u007ff\u0000g\u000bh",
];

it("round-trips 900 generated and special YAML values through Obsidian's parser", async () => {
  await installConsoleSpy();
  const values = [...special, ...fc.sample(sample, { seed: 4772, numRuns: 900 - special.length })];
  const lines = values.map((value) => yamlEntry("probe", value, "\n"));

  const parsed = await browser.executeObsidian(
    ({ plugins }, input) => plugins.noteStoreProbe.serializerFacts(input),
    lines,
  );
  expect(parsed).toEqual(values.map(yamlSampleValue));
  expect(await pluginProblems()).toEqual([]);
});

it("saves within Obsidian's recognized frontmatter fences and preserves the original bytes", async () => {
  await installConsoleSpy();
  const written = await browser.executeObsidian(({ plugins }) =>
    plugins.noteStoreProbe.writeFacts(),
  );
  expect(written).toEqual(WRITE_FACTS);
  expect(await pluginProblems()).toEqual([]);
});
