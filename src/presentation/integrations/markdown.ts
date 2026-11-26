type Inline = { readonly tag: "span" | "strong" | "em" | "code"; readonly text: string };
type Line = {
  readonly tag: "p" | "h4" | "blockquote" | "pre";
  readonly content: readonly Inline[];
};

function inline(text: string): readonly Inline[] {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/u);
  return tokens.filter(Boolean).map((token) => {
    if (token.startsWith("`") && token.endsWith("`"))
      return { tag: "code", text: token.slice(1, -1) };
    if (token.startsWith("**") && token.endsWith("**"))
      return { tag: "strong", text: token.slice(2, -2) };
    if (token.startsWith("*") && token.endsWith("*"))
      return { tag: "em", text: token.slice(1, -1) };
    return { tag: "span", text: token };
  });
}

function formatLine(line: string): Line {
  const imageAlt = line.replace(/!\[([^\]\n]*)\]\([^\n]*\)/gu, "$1");
  const heading = /^#{1,6}\s+(.+)$/u.exec(imageAlt);
  if (heading?.[1]) return { tag: "h4", content: inline(heading[1]) };
  const quote = /^>\s+(.+)$/u.exec(imageAlt);
  if (quote?.[1]) return { tag: "blockquote", content: inline(quote[1]) };
  return { tag: "p", content: inline(imageAlt.replace(/^\s*[-+*]\s+/u, "• ")) };
}

export function chatMarkdown(text: string): readonly Line[] {
  const blocks: Line[] = [];
  let code: string[] | undefined;
  function flushCode() {
    if (code?.length)
      blocks.push({ tag: "pre", content: [{ tag: "code", text: code.join("\n") }] });
    code = undefined;
  }
  for (const line of text.split(/\r?\n/u)) {
    if (line.startsWith("```")) {
      if (code) flushCode();
      else code = [];
    } else if (code) code.push(line);
    else if (line.trim()) blocks.push(formatLine(line));
  }
  flushCode();
  return blocks;
}
