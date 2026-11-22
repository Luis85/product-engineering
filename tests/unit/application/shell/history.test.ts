import { expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  historyAt,
  stepBack,
  stepForward,
  visit,
} from "../../../../src/application/shell";

const list = { name: "list" };
const primary = { name: "primary" };
const secondary = { name: "secondary" };
const equals = (left: typeof list, right: typeof list) => left.name === right.name;
const numberedRoute = (number: number) => ({ name: "number", number });
const sameNumber = (
  left: ReturnType<typeof numberedRoute>,
  right: ReturnType<typeof numberedRoute>,
) => left.name === right.name && left.number === right.number;

it("visits a new route and walks both stacks without modifying the original", () => {
  const initial = historyAt(list);
  const first = visit(initial, primary, equals);
  const second = visit(first, secondary, equals);
  expect(initial).toEqual({ current: list, back: [], forward: [] });
  expect(second).toEqual({ current: secondary, back: [list, primary], forward: [] });

  const back = stepBack(second);
  expect(back).toEqual({ current: primary, back: [list], forward: [secondary] });
  expect(stepForward(back)).toEqual(second);
});

it("does nothing when already on the requested route or at a stack boundary", () => {
  const initial = historyAt(list);
  expect(visit(initial, { name: "list" }, equals)).toBe(initial);
  expect(stepBack(initial)).toBe(initial);
  expect(stepForward(initial)).toBe(initial);
});

it("clears forward history on a new visit from a previous route", () => {
  const second = visit(visit(historyAt(list), primary, equals), secondary, equals);
  const branched = visit(stepBack(second), { name: "different" }, equals);
  expect(branched.back).toEqual([list, primary]);
  expect(branched.forward).toEqual([]);
  expect(stepForward(branched)).toBe(branched);
});

it("keeps exactly the most recent fifty visits available for back", () => {
  const queued = Array.from({ length: 75 }, (_, index) => index + 1).reduce(
    (history, number) => visit(history, numberedRoute(number), sameNumber),
    historyAt(numberedRoute(0)),
  );
  expect(HISTORY_LIMIT).toBe(50);
  expect(queued.back).toHaveLength(50);
  expect(queued.back[0]).toEqual(numberedRoute(25));
  expect(queued.current).toEqual(numberedRoute(75));

  const oldest = Array.from({ length: 50 }).reduce<typeof queued>(
    (history) => stepBack(history),
    queued,
  );
  expect(oldest.current).toEqual(numberedRoute(25));
  expect(stepBack(oldest)).toBe(oldest);
  expect(
    Array.from({ length: 50 }).reduce<typeof queued>((history) => stepForward(history), oldest),
  ).toEqual(queued);
});
