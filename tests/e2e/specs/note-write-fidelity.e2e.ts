import { browser, expect } from "@wdio/globals";
import * as fc from "fast-check";
import { it } from "mocha";
import { yamlEntry } from "../../../src/domain/notes";
import { WRITE_FACTS, yamlSampleValue } from "../../support/notes/fidelity";
import {
  fixtureId,
  itemCard,
  itemPath,
  openEdit,
  openItems,
  save,
  selectStatus,
  waitForNote,
  writeNote,
} from "../items";
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

it("changes one property through the item form while preserving the rest of the file bytes", async () => {
  await installConsoleSpy();
  const id = fixtureId(19);
  const path = itemPath("Exact bytes");
  const original =
    "\uFEFF" +
    [
      "---",
      "# A comment before the schema",
      "schema: product-engineering.item/v1",
      `id: ${id}`,
      "title: Exact bytes",
      "status: open  # keep this comment",
      "zip: 01067",
      "version_text: 1.10",
      "large_integer: 12345678901234567890",
      "flow: [a, b]",
      "confirmation: 'yes'",
      "'quoted-key': value  # preserve the key and comment",
      "list:",
      "- alpha",
      "- beta",
      "summary: |",
      "  A block scalar",
      "  with two lines.",
      "---",
      "# Original Markdown",
      "Trailing spaces stay.  ",
      "",
    ].join("\r\n");
  await writeNote(path, original);
  await openItems();
  await itemCard(id).waitForDisplayed();
  await openEdit(id);
  await selectStatus("done");
  await save();
  expect(await waitForNote(path, (text) => text.includes("status: done"))).toBe(
    original.replace("status: open", "status: done"),
  );
  expect(await pluginProblems()).toEqual([]);
});
