import { expect, it } from "vitest";
import { chatMarkdown } from "../../../../src/presentation/integrations/markdown";

it("renders supported inline Markdown and quotes as typed text blocks", () => {
  const result = chatMarkdown(
    "## Findings\r\n\r\n> **Verified** and *provisional* `AC-09`\r\n- Next action",
  );
  expect(result).toEqual([
    { tag: "h4", content: [{ tag: "span", text: "Findings" }] },
    {
      tag: "blockquote",
      content: [
        { tag: "strong", text: "Verified" },
        { tag: "span", text: " and " },
        { tag: "em", text: "provisional" },
        { tag: "span", text: " " },
        { tag: "code", text: "AC-09" },
      ],
    },
    { tag: "p", content: [{ tag: "span", text: "• Next action" }] },
  ]);
});

it("treats raw HTML, script syntax and fenced content as text and drops remote image source markup", () => {
  const url = "https://images.example.invalid/caption.png";
  const html = "<script>bad()</script>";
  const result = chatMarkdown(
    [
      `![Source panel](${url})`,
      html,
      "```html",
      '<img src="untrusted.png" />',
      "```",
      "After the example.",
    ].join("\n"),
  );
  expect(result).toEqual([
    { tag: "p", content: [{ tag: "span", text: "Source panel" }] },
    { tag: "p", content: [{ tag: "span", text: html }] },
    { tag: "pre", content: [{ tag: "code", text: '<img src="untrusted.png" />' }] },
    { tag: "p", content: [{ tag: "span", text: "After the example." }] },
  ]);
  expect(JSON.stringify(result)).not.toContain(url);
});

it("keeps the available code when a stream ends before its closing fence and omits empty runs", () => {
  expect(chatMarkdown("\n```\n```\n\n")).toEqual([]);
  expect(chatMarkdown("```md\n## Example\nkeep text")).toEqual([
    { tag: "pre", content: [{ tag: "code", text: "## Example\nkeep text" }] },
  ]);
});
