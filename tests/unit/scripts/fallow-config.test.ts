import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { fallowJson, syncFallowJson } from "../../../scripts/fallow-config.mjs";

const modules = { all: ["shell", "items"], core: ["shell"], features: ["items"] };
const has = (folder: string, module: string) => folder === "application" && module === "shell";

it("generates stable text and omits siblings without a folder", async () => {
  const input = { modules, has };
  const text = await fallowJson(input);

  expect(await fallowJson(input)).toBe(text);
  expect(text).toContain('"application/shell"');
  expect(text).not.toContain('"application/items"');
});

it("identifies a stale config and accepts the generated text", async () => {
  const dir = mkdtempSync(join(tmpdir(), "product-engineering-fallow-"));
  const path = join(dir, "fallow.json");
  try {
    const options = { path, check: true, modules, has };
    writeFileSync(path, "{}\n");

    await expect(syncFallowJson(options)).resolves.toBe(
      "configs/fallow.json does not match the module list: run `npm run fallow:config`.",
    );
    await expect(syncFallowJson({ ...options, check: false })).resolves.toBe("");
    await expect(syncFallowJson(options)).resolves.toBe("");
  } finally {
    rmSync(path, { force: true });
    rmdirSync(dir);
  }
});
