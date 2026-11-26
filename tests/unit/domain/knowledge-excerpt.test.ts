import { expect, it } from "vitest";
import { knowledgeExcerpt } from "../../../src/domain/knowledge";

it("summarizes visible text outside Markdown headings and fenced code", () => {
  const body = [
    "## Problem",
    "",
    "```ts",
    "a file path",
    "```",
    "~~~",
    "more code",
    "~~~",
    "[source]: https://example.invalid",
    "---",
    "<img src=x>",
    "1. **Approve** [[Project]] with [the team](https://example.invalid).",
  ].join("\r\n");
  expect(knowledgeExcerpt(body)).toBe("Approve Project with the team.");
  expect(knowledgeExcerpt("## Problem\n\n## Requirements\n")).toBe("");
  const text = "A".repeat(181);
  expect(knowledgeExcerpt(text)).toBe(`${text.slice(0, 179)}…`);
});
