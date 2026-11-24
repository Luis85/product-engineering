import { expect, it } from "vitest";
import { prototypeHtmlIssue, prototypeHtmlName } from "../../../../src/domain/prototypes";
import {
  legacyPrototypePreview,
  offlinePrototypePreview,
} from "../../../../src/presentation/prototypes/offline-preview";

it("projects safe markup, embedded raster assets and literal text actions into an isolated document", () => {
  const raw = `<!doctype html><html><head>
    <style>button { color: rgb(0, 1, 2); padding: clamp(1rem, 1vw, 2rem) }</style>
    <style>@import "https://example.invalid/never.css";</style>
    <link href="https://example.invalid/linked.css" rel="stylesheet">
    </head><body>
    <!-- preview comment -->
    <header aria-label="Begrüßung">Grüße &amp; &lt;Team&gt;</header>
    <section style="text-align:center">
      <button onclick="document.getElementById('named').textContent = 'Ausgewählt ✓'">Auswählen</button>
      <button onclick="document.querySelector('#named').innerText='Bestätigt'">Bestätigen</button>
      <button onclick="this.textContent='Fertig'">Fertigstellen</button>
      <button type="submit" onclick="fetch('https://example.invalid/api')">Ohne Aktion</button>
      <input type="checkbox" checked aria-label="Metadaten">
      <input type="image" src="https://example.invalid/input">
      <img alt="rasters" src="data:image/png;base64,AAAA">
      <img alt="entfernte Quelle" src="https://example.invalid/image">
      <p id="named" data-pe-offline-action="7" style="background-image:url(https://example.invalid/css)">Offen</p>
      <a href="#named">Springen</a>
      <svg><image href="https://example.invalid/svg"></image></svg>
      <form action="https://example.invalid/form"><input type="text" value="sichtbar"></form>
      <iframe src="https://example.invalid/frame"></iframe>
      <script>window.app = 1;</script>
    </section></body></html>`;
  const preview = offlinePrototypePreview(document, raw);
  expect(preview).toContain("script-src 'nonce-");
  expect(preview).toContain("connect-src 'none'");
  expect(preview).toContain("Grüße &amp; &lt;Team&gt;");
  expect(preview).toContain("color: rgb(0, 1, 2)");
  expect(preview).toContain('<input type="checkbox" checked=""');
  expect(preview).toContain('src="data:image/png;base64,AAAA"');
  expect(preview).toContain('<input type="text" value="sichtbar">');
  expect(preview).toContain("<a>Springen</a>");
  expect(preview).toContain('{"target":"named","text":"Ausgewählt ✓"}');
  expect(preview).toContain('{"target":"named","text":"Bestätigt"}');
  expect(preview).toContain('{"target":"","text":"Fertig"}');
  expect(preview.match(/data-pe-offline-action="/g)).toHaveLength(3);
  expect(preview).not.toContain("example.invalid");
  expect(preview).not.toContain("window.app");
  expect(raw).toContain("window.app");
});

it("escapes dangerous script delimiters and leaves noninteractive projection script-free", () => {
  const interaction = offlinePrototypePreview(
    document,
    `<button onclick="this.textContent='&lt;/script&gt; &amp; a'">Test</button>`,
  );
  expect(interaction).toContain('{"target":"","text":"\\u003c/script> & a"}');
  const nodes = offlinePrototypePreview(
    document,
    "<article>Nur Text</article><script>untrusted()</script>",
  );
  expect(nodes).toContain("<article>Nur Text</article>");
  expect(nodes).not.toContain("<script");
  const legacy = legacyPrototypePreview(document, {
    heading: "Servicefälle",
    caption: "Fälle der eigenen Organisation",
    contact: "Kontakt",
    status: "Status",
  });
  expect(legacy).toMatch(/script-src 'nonce-[^']+'/);
  expect(legacy).toMatch(/<script nonce="[^"]+">\s*const statusFilter/);
  expect(legacy).toContain("rows.forEach(addCaseToggle)");
  expect(legacy).toContain("<h1>Servicefälle</h1>");
});

it("checks byte size, well-formed Unicode and local HTML filenames", () => {
  expect(
    prototypeHtmlIssue("\uFEFF<!doctype html>\r\n<!-- fixture --> <h1>Grüße 🌿</h1>"),
  ).toBeUndefined();
  expect(prototypeHtmlIssue("<p>" + "ö".repeat(1024 * 1024) + "</p>")).toBe("outputTooLarge");
  expect(prototypeHtmlIssue("<main>broken\0</main>")).toBe("outputInvalid");
  expect(prototypeHtmlIssue("<main>broken\uD800</main>")).toBe("outputInvalid");
  expect(prototypeHtmlIssue("plain text")).toBe("outputInvalid");
  expect(prototypeHtmlName("Übergabe – offline.HTML")).toBe(true);
  expect(prototypeHtmlName("a.htm")).toBe(true);
  expect(prototypeHtmlName("one/two.html")).toBe(false);
  expect(prototypeHtmlName(".html")).toBe(false);
  expect(prototypeHtmlName("plain.csv")).toBe(false);
  expect(prototypeHtmlName("x\n.html")).toBe(false);
});
