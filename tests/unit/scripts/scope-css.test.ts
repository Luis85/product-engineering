import postcss, { parse } from "postcss";
import { describe, expect, it } from "vitest";
import { scopeCss, SCOPE_CLASS } from "../../../scripts/scope-css.mjs";

const id = "product-engineering";
const prefix = "pe";
const root = `.${SCOPE_CLASS}`;

function transform(
  css: string,
  options: { from?: string; skip?: (file: string) => boolean } = {},
): string {
  return postcss([scopeCss({ id, prefix, ...(options.skip && { skip: options.skip }) })]).process(
    css,
    { from: options.from },
  ).css;
}

function compact(css: string): string {
  return css.replaceAll(/\s+/g, "");
}

describe("CSS scope", () => {
  it("puts roots and themes on the plugin root and scopes each remaining selector", () => {
    expect(SCOPE_CLASS).toBe(`${id}-root`);
    const result = transform(
      `.a, :root, :host, .dark .panel, .light, html, body, *,\n ${root} .already { color: red }`,
    );
    expect(compact(result)).toBe(
      compact(`
      ${root} .a, ${root}, ${root}, ${root}.dark .panel, ${root}.light,
      ${root} html, ${root} body, ${root} *, ${root} .already { color: red }
    `),
    );
  });

  it("places ordinary selectors below the plugin root with a descendant combinator", () => {
    const rule = parse(transform(".a:hover, .b :is(p, li) { color: red }")).first;
    expect(rule && "selector" in rule ? rule.selector : undefined).toBe(
      `${root} .a:hover, ${root} .b :is(p, li)`,
    );
  });

  it("flattens layer blocks and statements and scopes selectors under conditional at-rules", () => {
    const result = transform(`
      @layer base, theme;
      @layer base {
        @media (width > 400px) {
          @layer nested {
            @supports (display: grid) {
              @container (width > 300px) { .panel {} }
            }
          }
        }
      }
    `);
    expect(compact(result)).toBe(
      compact(`@media (width > 400px) { @supports (display: grid) {
        @container (width > 300px) { ${root} .panel {} }
      } }`),
    );
  });

  it("renames animations and their Tailwind variables without scoping keyframe steps", () => {
    const result = transform(`
      @keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }
      @-webkit-keyframes glow { 50% { opacity: 1 } }
      @keyframes pe-existing { 0%, 100% { color: blue } }
      :root {
        --motion: var(--motion-inner);
        --motion-inner: spin 1s linear infinite;
        --unrelated: spin;
      }
      .direct {
        animation: 1s spin, 2s pe-existing;
        animation-name: spin, pe-existing;
        -webkit-animation: glow 1s;
      }
      .utility { animation: var(--motion); animation-name: var(--missing, spin); }
    `);
    expect(compact(result)).toBe(
      compact(`
      @keyframes pe-spin { from { rotate: 0deg } to { rotate: 360deg } }
      @-webkit-keyframes pe-glow { 50% { opacity: 1 } }
      @keyframes pe-existing { 0%, 100% { color: blue } }
      ${root} {
        --motion: var(--motion-inner);
        --motion-inner: pe-spin 1s linear infinite;
        --unrelated: spin;
      }
      ${root} .direct {
        animation: 1s pe-spin, 2s pe-existing;
        animation-name: pe-spin, pe-existing;
        -webkit-animation: pe-glow 1s;
      }
      ${root} .utility { animation: var(--motion); animation-name: var(--missing, pe-spin); }
    `),
    );
  });

  it("renames registered properties and references without changing CSS strings or other names", () => {
    const result = transform(`
      @property --tw-x { syntax: "<length>"; inherits: false; initial-value: 0px }
      @property --pe-y { syntax: "<length>"; inherits: false; initial-value: 0px }
      @supports (--tw-x: 0px) { :host { --tw-x: 2px; --tw-x-extra: var(--tw-x) } }
      .a {
        width: calc(var(--tw-x) + var(--tw-x-extra) + var(--pe-y));
        transition-property: --tw-x, --pe-y;
        content: "--tw-x";
      }
    `);
    expect(compact(result)).toBe(
      compact(`
      @property --pe-tw-x { syntax: "<length>"; inherits: false; initial-value: 0px }
      @property --pe-y { syntax: "<length>"; inherits: false; initial-value: 0px }
      @supports (--pe-tw-x: 0px) { ${root} { --pe-tw-x: 2px; --tw-x-extra: var(--pe-tw-x) } }
      ${root} .a {
        width: calc(var(--pe-tw-x) + var(--tw-x-extra) + var(--pe-y));
        transition-property: --pe-tw-x, --pe-y;
        content: "--tw-x";
      }
    `),
    );
  });

  it("keeps a skipped host stylesheet unchanged", () => {
    const hostCss = "@layer host { body { animation: spin 1s } } @keyframes spin { from {} }";
    expect(
      transform(hostCss, {
        from: "harness/fake-host.css",
        skip: (file) => file.endsWith("fake-host.css"),
      }),
    ).toBe(hostCss);
  });
});
