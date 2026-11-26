import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { checkPins, noHeadPlugins, REPLACED } from "../../../scripts/no-head-plugins.mjs";

const colorsPath = "runtime/plugins/colors.js";
const headPath = "runtime/vue/plugins/head.js";

it("uses a distinct no-op module for each known Nuxt UI head plugin", () => {
  const plugin = noHeadPlugins();
  const colors = plugin.resolveId("@nuxt/ui/" + colorsPath);
  const head = plugin.resolveId("@nuxt/ui/" + headPath);

  if (!colors || !head) throw new Error("Expected both Nuxt UI plugins to resolve");
  expect(colors).toBe("\0product-engineering:no-head/colors");
  expect(head).toBe("\0product-engineering:no-head/head");
  expect(plugin.load(colors)).toBe("export default { install() {} };");
  expect(plugin.load(head)).toBe("export default { install() {} };");
  expect(plugin.load("\0product-engineering:other")).toBeNull();
});

it("resolves the Nuxt UI plugins through generated paths without replacing unrelated files", () => {
  const plugin = noHeadPlugins();
  const dist = new URL(".", import.meta.resolve("@nuxt/ui/vite"));
  const installedColors = fileURLToPath(new URL(colorsPath, dist));
  const installedVuePlugin = fileURLToPath(new URL("runtime/vue/plugin.js", dist));
  const unrelated = fileURLToPath(new URL("../src/runtime/plugins/colors.js", import.meta.url));

  expect(plugin.resolveId(installedColors)).toBe("\0product-engineering:no-head/colors");
  expect(plugin.resolveId("./plugins/head.js", installedVuePlugin)).toBe(
    "\0product-engineering:no-head/head",
  );
  expect(plugin.resolveId(unrelated)).toBeNull();
  expect(plugin.resolveId("@nuxt/ui/runtime/plugins/other.js")).toBeNull();
});

it("accepts the reviewed installed Nuxt UI files", () => {
  expect(REPLACED.map(({ path }) => path)).toEqual([colorsPath, headPath]);
  expect(() => noHeadPlugins().buildStart()).not.toThrow();
});

it("names the installed Nuxt UI file whose checksum changed", () => {
  expect(() =>
    checkPins((file) => {
      const bytes = readFileSync(file);
      return file.replaceAll("\\", "/").endsWith(colorsPath)
        ? Buffer.concat([bytes, Buffer.from("\n// changed\n")])
        : bytes;
    }),
  ).toThrow("@nuxt/ui/runtime/plugins/colors.js");
});
