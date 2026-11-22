import type { EventRef, Events as ObsidianEvents } from "obsidian";

type Listener = (...data: unknown[]) => unknown;

class Registration {
  constructor(
    readonly owner: Events,
    readonly name: string,
    readonly callback: Listener,
    readonly context: unknown,
  ) {}
}

export class Events implements Pick<ObsidianEvents, "on" | "off" | "offref" | "trigger"> {
  readonly #listeners = new Map<string, Set<Registration>>();

  on(name: string, callback: Listener, context?: unknown): EventRef {
    const ref = new Registration(this, name, callback, context);
    const listeners = this.#listeners.get(name) ?? new Set<Registration>();
    listeners.add(ref);
    this.#listeners.set(name, listeners);
    return ref;
  }

  off(name: string, callback: Listener): void {
    for (const ref of this.#listeners.get(name) ?? []) {
      if (ref.callback === callback) this.offref(ref);
    }
  }

  offref(ref: EventRef): void {
    if (ref instanceof Registration && ref.owner === this) {
      this.#listeners.get(ref.name)?.delete(ref);
    }
  }

  trigger(name: string, ...data: unknown[]): void {
    const listeners = [...(this.#listeners.get(name) ?? [])];
    for (const ref of listeners) {
      try {
        ref.callback.apply(ref.context, data);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  listenerCount(name?: string): number {
    if (name !== undefined) return this.#listeners.get(name)?.size ?? 0;
    return [...this.#listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
  }
}

export function releaseEvent(ref: EventRef): void {
  if (ref instanceof Registration) ref.owner.offref(ref);
}
