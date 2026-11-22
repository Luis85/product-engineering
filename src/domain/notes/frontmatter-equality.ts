import type { Frontmatter } from "./note-type";

function collection(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
}

function sameShape(left: object, right: object): boolean {
  const leftList = Array.isArray(left);
  const rightList = Array.isArray(right);
  if (leftList && rightList) return left.length === right.length;
  return leftList === rightList;
}

function sameEntries(
  left: object,
  right: object,
  compare: (leftValue: unknown, rightValue: unknown) => boolean,
): boolean {
  const leftEntries: [string, unknown][] = Object.entries(left);
  const rightEntries: [string, unknown][] = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value], index) => {
      const match = rightEntries[index];
      return match !== undefined && key === match[0] && compare(value, match[1]);
    })
  );
}

export function sameFrontmatterValue(left: unknown, right: unknown): boolean {
  const visitedLeft = new WeakMap<object, object>();
  const visitedRight = new WeakMap<object, object>();

  function compare(leftValue: unknown, rightValue: unknown): boolean {
    if (!collection(leftValue) || !collection(rightValue)) return Object.is(leftValue, rightValue);
    if (!sameShape(leftValue, rightValue)) return false;
    const leftMatch = visitedLeft.get(leftValue);
    const rightMatch = visitedRight.get(rightValue);
    if (leftMatch !== undefined || rightMatch !== undefined) {
      return leftMatch === rightValue && rightMatch === leftValue;
    }
    visitedLeft.set(leftValue, rightValue);
    visitedRight.set(rightValue, leftValue);
    return sameEntries(leftValue, rightValue, compare);
  }

  return compare(left, right);
}

export function sameFrontmatter(left: Frontmatter, right: Frontmatter): boolean {
  return sameFrontmatterValue(left, right);
}
