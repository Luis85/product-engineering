import { bundledPrototypeHtml, legacyCaseScript, legacyCaseStyles } from "./legacy-case-controls";
import type { LegacyCaseLabels } from "./legacy-case-controls";

const allowedTags = new Set(
  "a abbr article aside b blockquote br button caption code col colgroup dd details div dl dt em fieldset figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img input kbd label legend li main mark meter nav ol optgroup option output p pre progress q s section select small span strong sub summary sup table tbody td textarea tfoot th thead time tr u ul var".split(
    " ",
  ),
);
const droppedTags = new Set([
  "applet",
  "embed",
  "frame",
  "frameset",
  "iframe",
  "link",
  "meta",
  "noscript",
  "object",
  "script",
  "template",
]);
const voidTags = new Set(["br", "col", "hr", "img", "input"]);
const sharedAttributes = new Set(
  "alt checked class colspan datetime disabled for height hidden id lang max maxlength min minlength multiple name open placeholder readonly role rows rowspan scope selected step title value width".split(
    " ",
  ),
);
const offlineTypes = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "email",
  "number",
  "password",
  "radio",
  "range",
  "search",
  "tel",
  "text",
  "time",
]);
const cssFunctions = new Set(
  "calc clamp cubic-bezier hsl hsla linear-gradient matrix max min minmax radial-gradient repeat rgb rgba rotate scale skew translate translatex translatey var".split(
    " ",
  ),
);

type TextAction = { readonly target: string; readonly text: string };
const namedTarget =
  /^(?:document\s*\.\s*getElementById\(\s*(['"])([\w-]+)\1\s*\)|document\s*\.\s*querySelector\(\s*(['"])#([\w-]+)\3\s*\)|this)\s*\.\s*(?:textContent|innerText)\s*=\s*(['"])([^'"\\]*)\5\s*;?\s*$/u;

function clickAction(value: string): TextAction | undefined {
  const match = namedTarget.exec(value.trim());
  if (match?.[6] !== undefined) return { target: match[2] ?? match[4] ?? "", text: match[6] };
}

const entities: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
const escape = (raw: string) => raw.replace(/[&<>"]/g, (character) => entities[character] ?? "");

function safeCss(raw: string) {
  const value = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/[\\@<>]/u.test(value)) return "";
  return Array.from(value.matchAll(/([\w-]+)\s*\(/gu)).every((match) =>
    cssFunctions.has(match[1]?.toLowerCase() ?? ""),
  )
    ? value
    : "";
}

function allowedAttribute(tag: string, name: string, value: string) {
  if (name === "type")
    return tag === "button" ? value === "button" : tag === "input" && offlineTypes.has(value);
  if (name === "src")
    return (
      tag === "img" && /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/iu.test(value)
    );
  return sharedAttributes.has(name) || /^aria-[a-z-]+$/u.test(name);
}

function markup(element: Element, children: string, actions: TextAction[]) {
  const tag = element.localName;
  if (!allowedTags.has(tag)) return children;
  const attributes = Array.from(element.attributes).flatMap(({ name, value }) => {
    const safe =
      name === "style" ? safeCss(value) : allowedAttribute(tag, name, value) ? value : undefined;
    return safe === undefined ? [] : [` ${name}="${escape(safe)}"`];
  });
  const action = tag === "button" && clickAction(element.getAttribute("onclick") ?? "");
  if (action) attributes.push(` data-pe-offline-action="${actions.push(action) - 1}"`);
  return `<${tag}${attributes.join("")}>${voidTags.has(tag) ? "" : children + `</${tag}>`}`;
}

function inner(node: Node, actions: TextAction[], styles: string[], depth = 0): string {
  if (depth > 128) return "";
  if (node.nodeType === 3) return escape(node.nodeValue ?? "");
  if (node.nodeType !== 1) return "";
  const element = node as Element;
  const tag = element.localName;
  if (element.namespaceURI !== "http://www.w3.org/1999/xhtml" || droppedTags.has(tag)) return "";
  if (tag === "style") {
    styles.push(safeCss(element.textContent ?? ""));
    return "";
  }
  const children = Array.from(node.childNodes, (child) =>
    inner(child, actions, styles, depth + 1),
  ).join("");
  return markup(element, children, actions);
}

function previewHead(nonce: string) {
  return `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'"><meta name="referrer" content="no-referrer">`;
}

function nonceFor(owner: Document) {
  const browser = owner.defaultView;
  if (!browser) return "";
  return browser.btoa(String.fromCharCode(...browser.crypto.getRandomValues(new Uint8Array(16))));
}

export function offlinePrototypePreview(owner: Document, html: string) {
  const source = owner.createElement("template");
  const range = source.content.ownerDocument.createRange();
  range.selectNodeContents(source.content);
  // eslint-disable-next-line no-unsanitized/method -- The range belongs to the inert template document. Only projected allowlisted markup enters the sandboxed frame.
  const fragment = range.createContextualFragment(html);
  const actions: TextAction[] = [];
  const styles: string[] = [];
  const body = Array.from(fragment.childNodes, (node) => inner(node, actions, styles)).join("");
  const nonce = nonceFor(owner);
  const data = JSON.stringify(actions).replace(/</g, "\\u003c");
  const shim = `const actions = ${data};
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-pe-offline-action]");
      const action = button && actions[button.dataset.peOfflineAction];
      if (!action) return;
      const target = action.target ? document.getElementById(action.target) : button;
      if (target) target.textContent = action.text;
    });`;
  return `<!doctype html><html><head>${previewHead(nonce)}
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html{color-scheme:light dark}body{overflow-wrap:anywhere;font:1rem system-ui;margin:1rem}img{max-width:100%;height:auto}${styles.join("\n")}</style>
    </head><body>${body}${actions.length ? `<script nonce="${nonce}">${shim}</script>` : ""}</body></html>`;
}

export function legacyPrototypePreview(owner: Document, labels: LegacyCaseLabels) {
  const nonce = nonceFor(owner);
  return bundledPrototypeHtml
    .replace("<head>", "<head>" + previewHead(nonce))
    .replace("</head>", legacyCaseStyles + "</head>")
    .replace(
      /<h1>[^<]*<\/h1><p>[^<]*<\/p>/u,
      () => `<h1>${escape(labels.heading)}</h1><p>${escape(labels.caption)}</p>`,
    )
    .replace("<script>", `<script nonce="${nonce}">`)
    .replace("</script>", () => legacyCaseScript(labels) + "</script>");
}
