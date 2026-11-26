import selectorParser from "postcss-selector-parser";

export const SCOPE_CLASS = "product-engineering-root";

const keyframes = /^(?:-\w+-)?keyframes$/i;
const animation = /^(?:-\w+-)?animation(?:-name)?$/i;
const roots = new Set([":root", ":host"]);
const themes = new Set(["light", "dark"]);

/**
 * @typedef {import("postcss").AtRule} AtRule
 * @typedef {import("postcss").ChildNode} ChildNode
 * @typedef {import("postcss").Declaration} Declaration
 * @typedef {import("postcss").Root} Root
 * @typedef {(node: ChildNode) => boolean} Skips
 */

/** @param {import("postcss-selector-parser").Selector} selector @param {string} scope */
function scopeSelector(selector, scope) {
  const first = selector.nodes.find((node) => node.type !== "comment");
  if (!first || (first.type === "class" && first.value === scope)) return;

  const anchor = selectorParser.className({
    value: scope,
    spaces: { before: first.spaces.before, after: "" },
  });
  first.spaces.before = "";
  if (first.type === "pseudo" && roots.has(first.value)) {
    first.replaceWith(anchor);
    return;
  }

  const theme = first.type === "class" && themes.has(first.value);
  if (!theme) selector.prepend(selectorParser.combinator({ value: " " }));
  selector.prepend(anchor);
}

/** @param {import("postcss").Rule} rule */
function isKeyframeStep(rule) {
  return rule.parent?.type === "atrule" && keyframes.test(rule.parent.name);
}

/** @param {string} text @param {Map<string, string>} names */
function renameTokens(text, names) {
  if (names.size === 0) return text;
  const token = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|[\w-]+/g;
  return text.replace(token, (name) => names.get(name) ?? name);
}

/** @param {AtRule} rule @param {Map<string, string>} names @param {string} prefix @param {string} leading */
function renameDefinition(rule, names, prefix, leading) {
  const name = rule.params.trim();
  const head = leading + prefix + "-";
  if (name.startsWith(head)) return;

  const scoped = head + name.slice(leading.length);
  names.set(name, scoped);
  rule.params = scoped;
}

/** @param {Root} root @param {Skips} skip */
function flattenLayers(root, skip) {
  /** @type {AtRule[]} */
  const layers = [];
  root.walkAtRules(/^layer$/i, (rule) => {
    if (!skip(rule)) layers.push(rule);
  });
  for (const layer of layers.toReversed()) {
    if (layer.nodes) layer.replaceWith(...layer.nodes);
    else layer.remove();
  }
}

/** @param {Root} root @param {Skips} skip @param {string} prefix */
function namespaceDefinitions(root, skip, prefix) {
  /** @type {Map<string, string>} */
  const animations = new Map();
  /** @type {Map<string, string>} */
  const properties = new Map();

  root.walkAtRules((rule) => {
    if (skip(rule)) return;
    if (keyframes.test(rule.name)) renameDefinition(rule, animations, prefix, "");
    if (rule.name.toLowerCase() === "property") renameDefinition(rule, properties, prefix, "--");
  });
  root.walkAtRules((rule) => {
    if (!skip(rule)) rule.params = renameTokens(rule.params, properties);
  });
  return { animations, properties };
}

/** @param {Root} root @param {Skips} skip @param {Map<string, string>} properties */
function prepareDeclarations(root, skip, properties) {
  /** @type {Set<Declaration>} */
  const animated = new Set();
  /** @type {Map<string, Declaration[]>} */
  const variables = new Map();

  root.walkDecls((declaration) => {
    if (skip(declaration)) return;
    declaration.prop = properties.get(declaration.prop) ?? declaration.prop;
    declaration.value = renameTokens(declaration.value, properties);

    if (animation.test(declaration.prop)) animated.add(declaration);
    if (!declaration.prop.startsWith("--")) return;
    const definitions = variables.get(declaration.prop) ?? [];
    definitions.push(declaration);
    variables.set(declaration.prop, definitions);
  });
  return { animated, variables };
}

/** @param {ReturnType<typeof prepareDeclarations>} declarations @param {Map<string, string>} names */
function rewriteAnimations({ animated, variables }, names) {
  if (names.size === 0) return;

  // Tailwind uses custom properties for animation shorthands. Visit only the
  // variables reached from animation declarations, including chained aliases.
  for (const declaration of animated) {
    for (const match of declaration.value.matchAll(/\bvar\(\s*(--[\w-]+)/g)) {
      const definitions = variables.get(match[1] ?? "");
      for (const definition of definitions ?? []) animated.add(definition);
    }
    declaration.value = renameTokens(declaration.value, names);
  }
}

/**
 * @param {{ id: string, prefix: string, skip?: (file: string) => boolean }} options
 * @returns {import("postcss").Plugin}
 */
export function scopeCss({ id, prefix, skip }) {
  const scope = id + "-root";
  const selectors = selectorParser((list) => {
    list.each((selector) => scopeSelector(selector, scope));
  });

  /** @type {Skips} */
  const skipped = (node) => {
    const file = node.source?.input.file;
    return file !== undefined && (skip?.(file) ?? false);
  };

  return {
    postcssPlugin: "product-engineering-scope-css",
    OnceExit(root) {
      flattenLayers(root, skipped);
      const { animations, properties } = namespaceDefinitions(root, skipped, prefix);
      rewriteAnimations(prepareDeclarations(root, skipped, properties), animations);

      root.walkRules((rule) => {
        if (!skipped(rule) && !isKeyframeStep(rule)) {
          rule.selector = selectors.processSync(rule.selector);
        }
      });
    },
  };
}
