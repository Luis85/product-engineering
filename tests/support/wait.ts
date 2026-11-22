import { vi } from "vitest";

const WAIT_BUDGET_MS = 4000;

export function eventually<A>(check: () => A | Promise<A>): Promise<A> {
  return vi.waitFor(check, { timeout: WAIT_BUDGET_MS, interval: 10 });
}
