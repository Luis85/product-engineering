// @ts-check
import { readFileSync } from "node:fs";
import ts from "typescript";

const MODULE_LIST = "src/application/modules.ts";
const CORE_MODULES = ["shell"];

/** @param {import("typescript").Expression} specifier */
function moduleFolder(specifier) {
  if (!ts.isStringLiteral(specifier)) return;
  return /^\.\/([a-z][a-z0-9-]*)$/.exec(specifier.text)?.[1];
}

/** @param {import("typescript").SourceFile} source */
function moduleImports(source) {
  /** @type {Map<string, string>} */
  const folders = new Map();

  for (const { moduleSpecifier, importClause } of source.statements.filter(
    ts.isImportDeclaration,
  )) {
    if (!importClause || importClause.isTypeOnly) continue;
    const folder = moduleFolder(moduleSpecifier);
    const bindings = importClause.namedBindings;
    if (!folder || !bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements.filter(({ isTypeOnly }) => !isTypeOnly)) {
      folders.set(element.name.text, folder);
    }
  }

  return folders;
}

/** @param {import("typescript").SourceFile} source */
function moduleEntries(source) {
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(({ name }) => ts.isIdentifier(name) && name.text === "APP_MODULES");
  const expression = declaration?.initializer;
  const array = expression && ts.isAsExpression(expression) ? expression.expression : expression;

  if (!array || !ts.isArrayLiteralExpression(array)) {
    throw new Error("APP_MODULES must be an array literal");
  }
  return array.elements;
}

/** @param {string} text */
export function parseModuleNames(text) {
  const source = ts.createSourceFile(MODULE_LIST, text, ts.ScriptTarget.Latest);
  const folders = moduleImports(source);

  return moduleEntries(source).map((entry) => {
    if (!ts.isIdentifier(entry)) {
      throw new Error("APP_MODULES may contain only imported identifiers");
    }
    const folder = folders.get(entry.text);
    if (!folder) throw new Error(`${entry.text} must be imported from "./<module>"`);
    return folder;
  });
}

/** @param {string} [text] */
export function readModules(
  text = readFileSync(new URL(`../${MODULE_LIST}`, import.meta.url), "utf8"),
) {
  const all = parseModuleNames(text);
  if (!CORE_MODULES.every((name, index) => all[index] === name)) {
    throw new Error(`APP_MODULES must start with ${CORE_MODULES.join(", ")}`);
  }
  return { all, core: [...CORE_MODULES], features: all.slice(CORE_MODULES.length) };
}
