// @ts-check
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isBuiltin } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parse } from "postcss";
import selectorParser from "postcss-selector-parser";
import ts from "typescript";
import manifest from "../manifest.json" with { type: "json" };

export const EXPECTED_FILES = ["manifest.json", "styles.css", "main.js"];
export const BUDGETS = { "main.js": 1_500_000, "styles.css": 250_000 };
export const CSS_PREFIX = "pe";

/** @typedef {{ id: string; prefix: string }} Identity */

/** @param {string} name */
function isExternal(name) {
  return (
    name === "obsidian" ||
    name === "electron" ||
    /^@(codemirror|lezer)\/[^/]+/.test(name) ||
    isBuiltin(name)
  );
}

/** @param {ts.Node} node */
function exportsPlugin(node) {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return false;
  }

  const { left } = node;
  return (
    ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.expression.text === "module" &&
    left.name.text === "exports"
  );
}

/** @param {ts.Expression} candidate */
function methodName(candidate) {
  if (ts.isIdentifier(candidate)) return candidate.text;
  if (ts.isPropertyAccessExpression(candidate)) return candidate.name.text;
}

/** @param {ts.Expression | undefined} target */
function remoteUrl(target) {
  if (target && ts.isStringLiteralLike(target) && /^https?:/i.test(target.text)) {
    return target.text;
  }
}

/** @param {ts.CallExpression} call @param {Set<string>} failures */
function checkCall(call, failures) {
  const name = methodName(call.expression);
  const [first, second] = call.arguments;
  if (name === "require" && first && ts.isStringLiteralLike(first) && !isExternal(first.text)) {
    failures.add('main.js requires unexpected external "' + first.text + '"');
  }

  const targets = name === "fetch" ? [first] : name === "open" ? [first, second] : [];
  for (const target of targets) {
    const url = remoteUrl(target);
    if (url) failures.add("main.js " + name + " targets a remote URL " + url);
  }
}

/** @param {string} code @param {string} id */
function checkJavaScript(code, id) {
  const source = ts.createSourceFile(
    "main.js",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  /** @type {Set<string>} */
  const failures = new Set();
  let hasExport = false;
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (exportsPlugin(node)) hasExport = true;
    if (ts.isCallExpression(node)) checkCall(node, failures);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!hasExport) failures.add("main.js must assign the plugin to module.exports");
  if (code.includes(id + "/test-only")) failures.add("main.js contains the test-only marker");
  return [...failures];
}

/** @param {string} name */
function isKeyframes(name) {
  return /^(?:-\w+-)?keyframes$/i.test(name);
}

/** @param {import("postcss").AtRule} rule @param {string} prefix */
function checkDirective({ name, params }, prefix) {
  const normalized = name.toLowerCase();
  if (normalized === "layer") return "styles.css contains a surviving @layer";
  if (isKeyframes(normalized) && !params.trim().startsWith(prefix + "-")) {
    return "styles.css contains an unprefixed @" + name + " " + params;
  }
  if (normalized === "property" && !params.trim().startsWith("--" + prefix + "-")) {
    return "styles.css contains an unprefixed @property " + params;
  }
}

/** @param {selectorParser.Selector} selector @param {string} scope */
function staysInScope(selector, scope) {
  const first = selector.nodes.find(({ type }) => type !== "comment");
  if (first?.type !== "class" || first.value !== scope) return false;

  const relationship = selector.nodes.find((node) => node.type === "combinator");
  const operator = relationship?.value.trim() ?? "";
  return operator === "" || operator === ">";
}

/** @param {import("postcss").Rule} rule @param {string} scope */
function checkSelector(rule, scope) {
  const parent = rule.parent;
  if (parent?.type === "atrule" && isKeyframes(parent.name)) return [];
  return selectorParser()
    .astSync(rule.selector)
    .nodes.filter((selector) => !staysInScope(selector, scope))
    .map((selector) => "styles.css contains unscoped selector " + selector.toString().trim());
}

/** @param {string} css @param {Identity} identity */
function checkStyles(css, { id, prefix }) {
  /** @type {string[]} */
  const failures = [];
  try {
    const root = parse(css, { from: "styles.css" });
    root.walkAtRules((rule) => {
      const problem = checkDirective(rule, prefix);
      if (problem) failures.push(problem);
    });
    root.walkRules((rule) => {
      failures.push(...checkSelector(rule, id + "-root"));
    });
  } catch (error) {
    failures.push(
      "styles.css could not be checked: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return failures;
}

/** @param {string} contents @param {unknown} rootManifest */
function checkManifest(contents, rootManifest) {
  try {
    /** @type {unknown} */
    const deployedManifest = JSON.parse(contents);
    return isDeepStrictEqual(deployedManifest, rootManifest)
      ? []
      : ["manifest.json differs from the root manifest"];
  } catch {
    return ["manifest.json is not valid JSON"];
  }
}

/** @param {string} dir */
function checkFiles(dir) {
  const entries = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
  const present = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const missing = EXPECTED_FILES.filter((name) => !present.has(name)).map(
    (name) => "Missing build file " + name,
  );
  const extra = entries
    .filter(({ name }) => !EXPECTED_FILES.includes(name))
    .map(({ name }) => "Unexpected build file " + name);
  return { present, failures: [...missing, ...extra] };
}

/** @param {string} dir @param {keyof typeof BUDGETS} name @param {(text: string) => string[]} check */
function checkAsset(dir, name, check) {
  const bytes = readFileSync(join(dir, name));
  if (bytes.length > BUDGETS[name]) {
    return [name + " exceeds its " + BUDGETS[name] + " byte budget (" + bytes.length + " bytes)"];
  }
  return check(bytes.toString("utf8"));
}

/** @param {string} dir @param {unknown} rootManifest @param {Identity} identity */
export function checkDist(dir, rootManifest, identity) {
  const { present, failures } = checkFiles(dir);
  if (present.has("manifest.json")) {
    failures.push(...checkManifest(readFileSync(join(dir, "manifest.json"), "utf8"), rootManifest));
  }
  if (present.has("main.js")) {
    failures.push(...checkAsset(dir, "main.js", (code) => checkJavaScript(code, identity.id)));
  }
  if (present.has("styles.css")) {
    failures.push(...checkAsset(dir, "styles.css", (css) => checkStyles(css, identity)));
  }
  return failures;
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../dist", import.meta.url));
  const failures = checkDist(dir, manifest, { id: manifest.id, prefix: CSS_PREFIX });
  if (failures.length > 0) {
    for (const problem of failures) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log("Distribution artifacts passed");
  }
}
