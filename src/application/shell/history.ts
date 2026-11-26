import type { RouteLike, Routes } from "./routes";

export const HISTORY_LIMIT = 50;

export type RouteHistory<R extends RouteLike> = {
  readonly current: R;
  readonly back: readonly R[];
  readonly forward: readonly R[];
};

export function historyAt<R extends RouteLike>(route: R): RouteHistory<R> {
  return { current: route, back: [], forward: [] };
}

function appendBack<R>(stack: readonly R[], route: R): readonly R[] {
  return [...stack, route].slice(-HISTORY_LIMIT);
}

export function visit<R extends RouteLike>(
  history: RouteHistory<R>,
  route: R,
  equals: Routes<R>["equals"],
): RouteHistory<R> {
  if (equals(history.current, route)) return history;
  return { current: route, back: appendBack(history.back, history.current), forward: [] };
}

export function stepBack<R extends RouteLike>(history: RouteHistory<R>): RouteHistory<R> {
  const previous = history.back.at(-1);
  if (previous === undefined) return history;
  return {
    current: previous,
    back: history.back.slice(0, -1),
    forward: [...history.forward, history.current],
  };
}

export function stepForward<R extends RouteLike>(history: RouteHistory<R>): RouteHistory<R> {
  const next = history.forward.at(-1);
  if (next === undefined) return history;
  return {
    current: next,
    back: appendBack(history.back, history.current),
    forward: history.forward.slice(0, -1),
  };
}
