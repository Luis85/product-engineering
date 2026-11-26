// @ts-check
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PACKAGES_FILE } from "./bundled-packages.mjs";
import { noticeOverrides } from "./notice-overrides.mjs";

export { PACKAGES_FILE };
export const NOTICES_FILE = "THIRD-PARTY-NOTICES.txt";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BUILD_REQUIRED = 'To refresh the bundled package report, run "npm run build" first.';
const licenseFile = /^(?:LICEN[CS]E|COPYING)(?:[._-][\w.-]+)?$/iu;
const noticeFile = /^(?:NOTICES?|THIRD[ _-]PARTY[ _-]NOTICES?)(?:[._-][\w.-]+)?$/iu;
const permittedLicense =
  /^(?:MIT|ISC|0BSD|BSD(?:-[234]-Clause(?:-[\w.-]+)?)?|Apache(?:-[12]\.\d)?)$/u;
const dependencySegment = /^@?[\w.-]+$/u;
const separator = "\n\n----------------------------------------------------------------\n\n";

/** @typedef {{ rootDir?: string; distDir?: string }} NoticeLocation */
/** @typedef {{ name: string; directory: string }} BundledPackage */
/** @typedef {{ packages: Set<string>; licenses: Set<string> }} NoticeGroup */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function jsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {string} file @returns {unknown} */
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** @param {string} file */
function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** @param {string} rootDir @param {string} distDir @returns {unknown[]} */
function reportedPackages(rootDir, distDir) {
  try {
    const report = readJson(join(rootDir, PACKAGES_FILE));
    if (
      jsonObject(report) &&
      Array.isArray(report.packages) &&
      report.sha256 === hashFile(join(distDir, "main.js")) &&
      report.stylesSha256 === hashFile(join(distDir, "styles.css"))
    )
      return report.packages;
  } catch (error) {
    throw new Error(BUILD_REQUIRED, { cause: error });
  }
  throw new Error(BUILD_REQUIRED);
}

/** @param {string} part */
function validDependencySegment(part) {
  return part !== "." && part !== ".." && dependencySegment.test(part);
}

/** @param {unknown} value @returns {BundledPackage} */
function packageReference(value) {
  if (!jsonObject(value) || typeof value.name !== "string" || typeof value.directory !== "string") {
    throw new Error("The bundled package report contains an invalid package entry");
  }
  const { name, directory } = value;
  const parts = directory.split("/");
  const installedName = parts.slice(parts.lastIndexOf("node_modules") + 1).join("/");
  if (
    parts[0] !== "node_modules" ||
    !parts.every(validDependencySegment) ||
    installedName !== name
  ) {
    throw new Error(`Invalid bundled package directory for ${name}`);
  }
  return { name, directory };
}

/** @param {string} name @param {string} license */
function confirmPermissiveLicense(name, license) {
  const terms = license.split(/[\s()]+/u).filter((term) => term && term !== "AND" && term !== "OR");
  if (!terms.length || terms.some((term) => !permittedLicense.test(term))) {
    throw new Error(`Review license ${JSON.stringify(license)} for bundled package ${name}`);
  }
}

/** @param {unknown} author */
function authorName(author) {
  const name = jsonObject(author) ? author.name : author;
  return typeof name === "string" ? name.trim() : "";
}

/** @param {string} author */
function mitText(author) {
  return `MIT License

Copyright (c) ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
}

/** @param {string} author */
function iscText(author) {
  return `ISC License

Copyright (c) ${author}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;
}

/** @param {string} name @param {string} license @param {unknown} author */
function standardText(name, license, author) {
  const attribution = authorName(author);
  if (attribution && license === "MIT") return mitText(attribution);
  if (attribution && license === "ISC") return iscText(attribution);
  throw new Error(
    `No license text for bundled package ${name}. Add evidence to scripts/notice-overrides.mjs.`,
  );
}

/** @param {string} text */
function normalizeText(text) {
  return text.replace(/\r\n?/gu, "\n").replace(/\n+$/u, "");
}

/** @param {string} directory */
function legalFiles(directory) {
  const files = readdirSync(directory, { withFileTypes: true }).filter(
    (entry) => entry.isFile() && (licenseFile.test(entry.name) || noticeFile.test(entry.name)),
  );
  return files
    .map(({ name }) => ({ name, text: normalizeText(readFileSync(join(directory, name), "utf8")) }))
    .filter(({ text }) => text.trim().length > 0);
}

/** @param {string} directory @param {string} name */
function packageManifest(directory, name) {
  const metadata = readJson(join(directory, "package.json"));
  if (!jsonObject(metadata) || metadata.name !== name) {
    throw new Error(`Bundled package ${name} does not match the installed package.json`);
  }
  return metadata;
}

/** @param {string} name @param {unknown} declared @param {string | undefined} fallback */
function packageLicense(name, declared, fallback) {
  const license = (typeof declared === "string" ? declared.trim() : "") || fallback;
  if (!license) {
    throw new Error(
      `No license field for bundled package ${name}. Add evidence to scripts/notice-overrides.mjs.`,
    );
  }
  confirmPermissiveLicense(name, license);
  return license;
}

/** @param {string} directory @param {string} name */
function packageNotices(directory, name) {
  const metadata = packageManifest(directory, name);
  const override = Object.hasOwn(noticeOverrides, name) ? noticeOverrides[name] : undefined;
  const license = packageLicense(name, metadata.license, override?.license);
  const files = legalFiles(directory);
  const texts = files.map(({ text }) => text);
  if (files.some(({ name: file }) => licenseFile.test(file))) return { license, texts };
  if (override) {
    confirmPermissiveLicense(name, override.license);
    return { license: override.license, texts: [override.text, ...texts] };
  }
  return { license, texts: [standardText(name, license, metadata.author), ...texts] };
}

/** @param {Map<string, NoticeGroup>} groups @param {string} text @param {string} name @param {string} license */
function groupNotice(groups, text, name, license) {
  const group = groups.get(text) ?? { packages: new Set(), licenses: new Set() };
  group.packages.add(name);
  group.licenses.add(license);
  groups.set(text, group);
}

/** @param {NoticeLocation} [location] */
export function renderNotices({ rootDir = ROOT, distDir = join(rootDir, "dist") } = {}) {
  /** @type {Map<string, NoticeGroup>} */
  const groups = new Map();
  for (const raw of reportedPackages(rootDir, distDir)) {
    const { name, directory } = packageReference(raw);
    const { license, texts } = packageNotices(join(rootDir, directory), name);
    for (const text of texts) groupNotice(groups, text, name, license);
  }

  const sections = [...groups]
    .map(
      ([text, { packages, licenses }]) =>
        `Packages: ${[...packages].toSorted().join(", ")}\nLicenses: ${[...licenses].toSorted().join(", ")}\n\n${text}`,
    )
    .toSorted();
  return ["Product Engineering third-party notices", ...sections].join(separator) + "\n";
}

/** @param {NoticeLocation & { check?: boolean }} [options] */
export function updateNotices({
  rootDir = ROOT,
  distDir = join(rootDir, "dist"),
  check = false,
} = {}) {
  const path = join(rootDir, NOTICES_FILE);
  const next = renderNotices({ rootDir, distDir });
  if (!check) {
    writeFileSync(path, next);
    return;
  }
  if (!existsSync(path) || readFileSync(path, "utf8") !== next) {
    throw new Error(`${NOTICES_FILE} is out of date`);
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(resolve(entry)).href === import.meta.url) {
  try {
    updateNotices({ check: process.argv.includes("--check") });
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  }
}
