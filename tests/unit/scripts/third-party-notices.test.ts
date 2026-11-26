import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  NOTICES_FILE,
  PACKAGES_FILE,
  renderNotices,
  updateNotices,
} from "../../../scripts/third-party-notices.mjs";

const fixtures: string[] = [];
const main = "module.exports = class {}\n";
const styles = ".product-engineering-root {}\n";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

function project() {
  const rootDir = mkdtempSync(join(tmpdir(), "product-engineering-notices-"));
  fixtures.push(rootDir);
  const write = (file: string, text: string) => {
    const target = join(rootDir, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  };
  function install(
    name: string,
    metadata: Record<string, unknown>,
    legal: Record<string, string> = {},
    directory = `node_modules/${name}`,
  ) {
    write(`${directory}/package.json`, JSON.stringify({ name, version: "9.8.7", ...metadata }));
    for (const [file, text] of Object.entries(legal)) write(`${directory}/${file}`, text);
    return { name, directory };
  }
  function build(packages: readonly { name: string; directory: string }[]) {
    write("dist/main.js", main);
    write("dist/styles.css", styles);
    write(
      PACKAGES_FILE,
      JSON.stringify({ sha256: hash(main), stylesSha256: hash(styles), packages }),
    );
  }
  return { rootDir, write, install, build };
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("third-party notices", () => {
  it("groups exact texts, preserves different copyrights and ships only bundled packages", () => {
    const fixture = project();
    const same = "MIT License\n\nCopyright (c) The First Authors\n";
    const another = "MIT License\n\nCopyright (c) The Other Authors\n";
    const direct = fixture.install("@example/z-ui", { license: "MIT" }, { "LICENSE.md": same });
    const nested = fixture.install(
      "tiny",
      { license: "MIT" },
      { LICENCE: same.replaceAll("\n", "\r\n"), "NOTICE.txt": "Supplementary attribution\n" },
      "node_modules/@example/z-ui/node_modules/tiny",
    );
    const different = fixture.install("a-utility", { license: "MIT" }, { "COPYING.txt": another });
    fixture.install("tiny", { license: "GPL-3.0-only" });
    fixture.install("not-bundled", { license: "GPL-3.0-only" });

    fixture.build([nested, different, direct, direct]);
    const notice = renderNotices({ rootDir: fixture.rootDir });
    expect(notice).toContain("Packages: @example/z-ui, tiny\nLicenses: MIT\n");
    expect(notice).toContain("Packages: a-utility\nLicenses: MIT\n");
    expect(notice).toContain("The First Authors");
    expect(notice).toContain("The Other Authors");
    expect(notice).toContain("Supplementary attribution");
    expect(notice).not.toMatch(/9\.8\.7|GPL-3\.0|not-bundled|\r/);
    expect(notice.match(/The First Authors/g)).toHaveLength(1);
    fixture.build([direct, different, nested]);
    expect(renderNotices({ rootDir: fixture.rootDir })).toBe(notice);
  });

  it("uses an own author for MIT or ISC when the installed package omits license text", () => {
    const fixture = project();
    fixture.build([
      fixture.install(
        "tiny-mit",
        { license: "MIT", author: { name: "Example Team" } },
        { NOTICE: "More attribution" },
      ),
      fixture.install("tiny-isc", { license: "ISC", author: "Another Team" }),
    ]);
    const notice = renderNotices({ rootDir: fixture.rootDir });
    expect(notice).toContain("MIT License\n\nCopyright (c) Example Team");
    expect(notice).toContain("ISC License\n\nCopyright (c) Another Team");
    expect(notice).toContain("More attribution");
  });

  it("uses official Lucide and Vaul Vue evidence only for bundled packages lacking license files", () => {
    const fixture = project();
    const lucide = fixture.install("@iconify-json/lucide", { license: "ISC" });
    const vaul = fixture.install("vaul-vue", {});
    fixture.build([lucide]);
    expect(renderNotices({ rootDir: fixture.rootDir })).toContain("Cole Bemis");
    expect(renderNotices({ rootDir: fixture.rootDir })).not.toContain("vaul-vue");

    fixture.build([vaul]);
    expect(renderNotices({ rootDir: fixture.rootDir })).toContain(
      "Packages: vaul-vue\nLicenses: MIT\n",
    );
    expect(renderNotices({ rootDir: fixture.rootDir })).toContain(
      'THE SOFTWARE IS PROVIDED "AS IS"',
    );
  });

  it.each([
    [{ license: "GPL-3.0-only", author: "An Author" }, { LICENSE: "GPL text" }, /GPL-3.0-only/],
    [
      { license: "MIT OR GPL-3.0-only", author: "An Author" },
      { LICENSE: "License text" },
      /GPL-3.0-only/,
    ],
    [{}, { LICENSE: "License text" }, /license field/],
    [{ license: "BSD-3-Clause", author: "An Author" }, {}, /license text/],
    [{ license: "MIT" }, {}, /license text/],
  ])("names the bundled package when its licensing needs review", (metadata, legal, issue) => {
    const fixture = project();
    fixture.build([fixture.install("needs-review", metadata, legal)]);
    expect(() => renderNotices({ rootDir: fixture.rootDir })).toThrow(/needs-review/);
    expect(() => renderNotices({ rootDir: fixture.rootDir })).toThrow(issue);
  });

  it.each(["main.js", "styles.css"])("rejects a bundle report for a different %s", (file) => {
    const fixture = project();
    fixture.build([]);
    fixture.write(`dist/${file}`, "Out of date");
    expect(() => renderNotices({ rootDir: fixture.rootDir })).toThrow(/run "npm run build" first/);
  });

  it("requires the production report and rejects paths outside the dependency installation", () => {
    const fixture = project();
    expect(() => renderNotices({ rootDir: fixture.rootDir })).toThrow(/run "npm run build" first/);
    fixture.build([{ name: "outside", directory: "node_modules/../outside" }]);
    expect(() => renderNotices({ rootDir: fixture.rootDir })).toThrow(/outside/);
  });

  it("checks exact notice contents and only rewrites when asked", () => {
    const fixture = project();
    fixture.build([fixture.install("example", { license: "ISC", author: "An Author" })]);
    const { rootDir } = fixture;
    expect(() => updateNotices({ rootDir, check: true })).toThrow(
      "THIRD-PARTY-NOTICES.txt is out of date",
    );
    updateNotices({ rootDir });
    expect(readFileSync(join(rootDir, NOTICES_FILE), "utf8")).toBe(renderNotices({ rootDir }));
    expect(() => updateNotices({ rootDir, check: true })).not.toThrow();
    fixture.write(NOTICES_FILE, "Old notices");
    expect(() => updateNotices({ rootDir, check: true })).toThrow(
      "THIRD-PARTY-NOTICES.txt is out of date",
    );
    expect(readFileSync(join(rootDir, NOTICES_FILE), "utf8")).toBe("Old notices");
  });
});
