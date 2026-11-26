const horizontalWhitespace = /[ \t]/;
const quoteStarter = /['"]/;
const anchorStarter = /[&*]/;
const flowStart = /[[{]/;
const flowEnd = /[\]}]/;
const flowSeparator = /[,:]/;

export function quotedEnd(text: string, start: number): number {
  const quote = text[start];
  for (let index = start + 1; index < text.length; index += 1) {
    if (quote === '"' && text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text[index] !== quote) continue;
    if (quote === "'" && text[index + 1] === quote) {
      index += 1;
      continue;
    }
    return index;
  }
  return text.length;
}

interface ValueScan {
  readonly comment?: string;
  readonly anchored: boolean;
}

interface ParsePosition {
  index: number;
  depth: number;
  valueStart: boolean;
  anchored: boolean;
}

function consumeValueCharacter(text: string, character: string, position: ParsePosition): void {
  if (position.valueStart) {
    if (quoteStarter.test(character)) {
      position.index = quotedEnd(text, position.index);
    }
    if (anchorStarter.test(character)) position.anchored = true;
    if (flowStart.test(character)) {
      position.depth += 1;
      return;
    }
  }
  if (flowEnd.test(character)) {
    position.depth = Math.max(0, position.depth - 1);
  }
  position.valueStart = position.depth > 0 && flowSeparator.test(character);
}

export function scanValueLine(text: string): ValueScan {
  const position: ParsePosition = { index: 0, depth: 0, valueStart: true, anchored: false };
  let whitespaceStart = 0;
  for (; position.index < text.length; position.index += 1) {
    const character = text.charAt(position.index);
    if (horizontalWhitespace.test(character)) continue;
    if (character === "#" && position.index > whitespaceStart) {
      return { comment: text.slice(whitespaceStart), anchored: position.anchored };
    }
    consumeValueCharacter(text, character, position);
    whitespaceStart = position.index + 1;
  }
  return { anchored: position.anchored };
}
