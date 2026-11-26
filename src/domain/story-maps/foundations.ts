const fence = /^(?:`{3,}|~{3,})/;
const heading = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;

function* markdownLines(body: string) {
  let delimiter: string | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const boundary = fence.exec(line)?.[0];
    if (boundary) {
      if (!delimiter) delimiter = boundary;
      else if (boundary.startsWith(delimiter)) delimiter = undefined;
      continue;
    }
    if (!delimiter && line) yield line;
  }
}

function firstSectionLine(body: string, match: RegExp) {
  let active = false;
  for (const line of markdownLines(body)) {
    const section = heading.exec(line);
    if (section) {
      active = section[1] === "##" && match.test(section[2] ?? "");
    } else if (active) {
      return line;
    }
  }
  return "";
}

export function extractStoryMapFoundationDraft(
  title: string,
  prd: string,
  vision: string | undefined,
  job: string | undefined,
  limits: { readonly persona: number; readonly goal: number },
) {
  const audience = firstSectionLine(vision ?? "", /^(Zielgruppe|Target audience)$/i);
  const outcome = firstSectionLine(prd, /(?:Ergebnis|Outcome)$/i);
  const progress = firstSectionLine(job ?? "", /^(Angestrebter Fortschritt|Desired progress)$/i);
  return {
    title,
    persona: audience.replaceAll(/\s+/g, " ").slice(0, limits.persona).trimEnd(),
    goal: (outcome || progress).slice(0, limits.goal).trimEnd(),
  };
}
