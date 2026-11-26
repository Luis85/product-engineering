import type { GitFile } from "../../application/git";

export const diffPageSize = 400;
const maximumSearch = 400;
const origin = maximumSearch + 1;
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
const linesOf = (file: GitFile | undefined) =>
  file ? (decoder.decode(file.bytes).match(/[^\n]*\n|[^\n]+$/g) ?? []) : [];

type DiffLine = { readonly kind: "add" | "remove" | "same"; readonly text: string };

const at = (frontier: Int32Array, diagonal: number) => frontier[origin + diagonal] ?? -1;

function previousDiagonal(frontier: Int32Array, distance: number, diagonal: number) {
  return diagonal === -distance ||
    (diagonal !== distance && at(frontier, diagonal - 1) < at(frontier, diagonal + 1))
    ? diagonal + 1
    : diagonal - 1;
}

function newFrontier() {
  return new Int32Array(2 * origin + 1).fill(-1);
}

function traceEdits(before: readonly string[], after: readonly string[]) {
  // Each Myers frontier stores the furthest point reached on each diagonal.
  let previous = newFrontier();
  previous[origin + 1] = 0;
  const trace: Int32Array[] = [];
  const steps = Math.min(maximumSearch, before.length + after.length);
  for (let distance = 0; distance <= steps; distance++) {
    const next = newFrontier();
    trace.push(next);
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const back = previousDiagonal(previous, distance, diagonal);
      let x = at(previous, back) + Number(back < diagonal);
      let y = x - diagonal;
      while (x < before.length && y < after.length && before[x] === after[y]) {
        x++;
        y++;
      }
      next[origin + diagonal] = x;
      if (x === before.length && y === after.length) return trace;
    }
    previous = next;
  }
}

function restoreLines(
  before: readonly string[],
  after: readonly string[],
  trace: readonly Int32Array[],
) {
  const lines: DiffLine[] = [];
  const original = (index: number) => before[index] ?? "";
  const saved = (index: number) => after[index] ?? "";
  let x = before.length;
  let y = after.length;
  for (let distance = trace.length - 1; distance > 0; distance--) {
    const previous = trace[distance - 1];
    if (!previous) break;
    const diagonal = previousDiagonal(previous, distance, x - y);
    const previousX = at(previous, diagonal);
    const previousY = previousX - diagonal;
    while (x > previousX && y > previousY) {
      lines.push({ kind: "same", text: original(--x) });
      y--;
    }
    if (x === previousX) lines.push({ kind: "add", text: saved(--y) });
    else lines.push({ kind: "remove", text: original(--x) });
  }
  while (x > 0) lines.push({ kind: "same", text: original(--x) });
  return lines.toReversed();
}

function replaceRange(before: readonly string[], after: readonly string[]): DiffLine[] {
  // A heavily rewritten range can be represented by its full removals and additions.
  let prefix = 0;
  const size = Math.min(before.length, after.length);
  while (prefix < size && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < size - prefix && before.at(-suffix - 1) === after.at(-suffix - 1)) suffix++;
  const beforeEnd = before.length - suffix;
  const afterEnd = after.length - suffix;
  return [
    ...before.slice(0, prefix).map((text): DiffLine => ({ kind: "same", text })),
    ...before.slice(prefix, beforeEnd).map((text): DiffLine => ({ kind: "remove", text })),
    ...after.slice(prefix, afterEnd).map((text): DiffLine => ({ kind: "add", text })),
    ...before.slice(beforeEnd).map((text): DiffLine => ({ kind: "same", text })),
  ];
}

export function gitDiff(base: GitFile | undefined, current: GitFile | undefined) {
  const before = linesOf(base);
  const after = linesOf(current);
  const trace = traceEdits(before, after);
  const lines = trace ? restoreLines(before, after, trace) : replaceRange(before, after);
  const changedPages = new Set<number>();
  for (const [index, line] of lines.entries()) {
    if (line.kind !== "same") changedPages.add(Math.floor(index / diffPageSize));
  }
  return { lines, changedPages: [...changedPages], identical: changedPages.size === 0 };
}
