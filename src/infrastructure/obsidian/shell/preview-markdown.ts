function fence(line: string) {
  return /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line);
}

function previewLine(line: string, isLocalImage: (target: string) => boolean) {
  const code = /(?<!`)(`+)(?!`).*?\1(?!`)/g;
  let start = 0;
  let output = "";
  for (const match of line.matchAll(code)) {
    output += previewText(line.slice(start, match.index), isLocalImage) + match[0];
    start = match.index + match[0].length;
  }
  return output + previewText(line.slice(start), isLocalImage);
}

function previewText(text: string, isLocalImage: (target: string) => boolean) {
  const resources =
    /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[(?!\[)(?:\\.|[^\]\\])*\]\(\s*(<[^>]*>|[^\s()]*)[^)]*\)|!\[(?!\[)|<(?=\/?[a-z!][\w!-]*(?=[\s/>]))/gi;
  return text.replace(
    resources,
    (token, wiki: string | undefined, markdown: string | undefined) => {
      if (token === "<") return "&lt;";
      const target = wiki ?? markdown;
      return target && isLocalImage(target.replace(/^<|>$/g, "")) ? token : token.slice(1);
    },
  );
}

export function previewMarkdown(source: string, isLocalImage: (target: string) => boolean) {
  let opening: string | undefined;
  return source
    .split(/(\r\n|\n|\r)/)
    .map((line) => {
      const match = fence(line);
      const marker = match?.[1];
      const info = match?.[2]?.trim() ?? "";
      if (opening) {
        if (marker?.startsWith(opening) && !info) opening = undefined;
        return line;
      }
      if (!marker || (marker.startsWith("`") && info.includes("`"))) {
        return previewLine(line, isLocalImage);
      }
      opening = marker;
      return line;
    })
    .join("");
}
