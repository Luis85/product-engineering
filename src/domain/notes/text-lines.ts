export interface TextLine {
  readonly start: number;
  readonly end: number;
  readonly content: string;
  readonly eol: string;
}

export function* textLines(text: string): Generator<TextLine, void> {
  let start = 0;
  for (const match of text.matchAll(/\r\n|[\r\n]/g)) {
    const eol = match[0];
    const end = match.index + eol.length;
    yield { start, end, content: text.slice(start, match.index), eol };
    start = end;
  }
  if (start < text.length) {
    yield { start, end: text.length, content: text.slice(start), eol: "" };
  }
}
