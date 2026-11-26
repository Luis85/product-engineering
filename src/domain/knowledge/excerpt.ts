const FENCE = /^(?:`{3,}|~{3,})/;

function readable(line: string) {
  return line
    .replace(/^\s*(?:[-*+>]\s+|\d+[.)]\s+)/, "")
    .replace(
      /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_link, target: string, alias?: string) => alias ?? target,
    )
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(\*\*|__|`)/g, "")
    .trim();
}

function visibleText(line: string) {
  if (!line || /^(?:#{1,6}\s|---+$|\[\S+\]:)/.test(line)) return "";
  return readable(line);
}

export function knowledgeExcerpt(body: string): string {
  let fence: string | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const delimiter = FENCE.exec(line)?.[0];
    if (delimiter) {
      if (!fence) fence = delimiter;
      else if (delimiter.startsWith(fence)) fence = undefined;
      continue;
    }
    if (fence) continue;
    const text = visibleText(line);
    if (text) return text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text;
  }
  return "";
}
