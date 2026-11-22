import { effectScope, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDelayed } from "../../../../src/presentation/shell";
import { LOADING_DELAY_MS } from "../../../../src/presentation/shell/delay";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("shows loading only after the same uninterrupted request has waited 300 ms", () => {
  const pending = ref(false);
  const scope = effectScope();
  try {
    const delayed = scope.run(() => useDelayed(pending));
    if (!delayed) throw new Error("Expected a loading ref");
    expect(LOADING_DELAY_MS).toBe(300);
    pending.value = true;
    vi.advanceTimersByTime(250);
    pending.value = false;
    pending.value = true;
    vi.advanceTimersByTime(299);
    expect(delayed.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(delayed.value).toBe(true);
    pending.value = false;
    expect(delayed.value).toBe(false);
  } finally {
    scope.stop();
  }
});

it("cancels the delay when the component scope ends", () => {
  const scope = effectScope();
  const delayed = scope.run(() => useDelayed(ref(true)));
  if (!delayed) throw new Error("Expected a loading ref");
  scope.stop();
  vi.advanceTimersByTime(LOADING_DELAY_MS);
  expect(delayed.value).toBe(false);
});
