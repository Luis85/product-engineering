import type { Component } from "vue";
import type { Catalog } from "../../application/messages";
import type { AppModuleName } from "../../application/modules";
import type { Route, RouteNameOf, SectionIdOf } from "../../application/routes";
import { HISTORY_LIMIT, historyAt, stepBack, stepForward, visit } from "../../application/shell";
import type { RouteHistory, RouteLike, Routes } from "../../application/shell";

export type ScreenLoader = () => Promise<Component>;

type Label = (catalog: Catalog) => string;

export type SettingsSectionPart = {
  readonly label: Label;
  readonly component: ScreenLoader;
  readonly badge?: ScreenLoader;
};

export type SurfaceSection<R extends RouteLike> = SettingsSectionPart & {
  readonly id: string;
  readonly route: R;
};

export type MenuEntry<R extends RouteLike> = {
  readonly route: R;
  readonly label: Label;
  readonly icon: `i-lucide-${string}`;
};

type Parts<Names extends string, Part> = [Names] extends [never]
  ? Readonly<Record<string, never>>
  : Readonly<Record<Names, Part>>;

export type ModuleScreens<Name extends AppModuleName> = {
  readonly screens: Parts<RouteNameOf<Name>, ScreenLoader>;
  readonly sections: Parts<SectionIdOf<Name>, SettingsSectionPart>;
  readonly menu?: readonly MenuEntry<Route>[];
  readonly context?: ScreenLoader;
};

export type SurfaceDefinition<R extends RouteLike> = Routes<R> & {
  readonly frame?: ScreenLoader;
  readonly screen: (route: R) => ScreenLoader | undefined;
  readonly menu: readonly MenuEntry<R>[];
  readonly context?: ScreenLoader;
  readonly sections?: readonly SurfaceSection<R>[];
};

export function frameMenu<R extends RouteLike>(
  definition: SurfaceDefinition<R>,
): readonly MenuEntry<R>[] {
  const first = definition.sections?.[0];
  if (!first) return definition.menu;
  return [
    ...definition.menu,
    {
      route: first.route,
      label: (catalog) => catalog.shell.frame.settings,
      icon: "i-lucide-settings",
    },
  ];
}

export type ViewNavigation<R extends RouteLike> = {
  readonly current: () => R;
  readonly history: () => RouteHistory<R>;
  readonly navigate: (route: R) => boolean | Promise<boolean>;
  readonly back: () => boolean | Promise<boolean>;
  readonly forward: () => boolean | Promise<boolean>;
  readonly onChange: (listener: (route: R) => void) => () => void;
  readonly beforeNavigate: (guard: BeforeNavigation<R>) => () => void;
  readonly confirmProjectCreation: (chooser: R) => boolean | Promise<boolean>;
  readonly onSignal: (signal: string, listener: () => void) => () => void;
  readonly railCollapsed: () => boolean;
  readonly setRailCollapsed: (value: boolean) => void;
  readonly onRailChange: (listener: (collapsed: boolean) => void) => () => void;
};

export type BeforeNavigation<R extends RouteLike> = (change: {
  readonly from: R;
  readonly to: R;
  readonly kind: "navigate" | "back" | "forward" | "create-project";
}) => boolean | Promise<boolean>;

export type MemoryNavigation<R extends RouteLike> = ViewNavigation<R> & {
  readonly sendSignal: (signal: string) => void;
  readonly reset: (route: R) => void;
  readonly visited: readonly R[];
  readonly listeners: () => number;
};

export function memoryNavigation<R extends RouteLike>(
  routes: Routes<R>,
  initial: R = routes.start,
): MemoryNavigation<R> {
  let state = historyAt(initial);
  const visited: R[] = [initial];
  const listeners = new Set<(route: R) => void>();
  const guards = new Set<BeforeNavigation<R>>();
  const signals = new Map<string, () => void>();
  const pendingSignals = new Set<string>();
  const railListeners = new Set<(value: boolean) => void>();
  let collapsed = false;
  let deciding = false;

  function update(next: RouteHistory<R>): void {
    if (next === state) return;
    state = next;
    visited.push(state.current);
    if (visited.length > HISTORY_LIMIT + 1) visited.shift();
    for (const listener of listeners) listener(state.current);
  }

  type ChangeKind = Parameters<BeforeNavigation<R>>[0]["kind"];
  function confirm(to: R, kind: ChangeKind, commit?: () => void) {
    if (deciding) return false;
    const before = state;
    const checks = [...guards];
    const transition = { from: before.current, to, kind };
    function apply(index: number): boolean | Promise<boolean> {
      for (const guard of checks.slice(index)) {
        index += 1;
        if (!guards.has(guard)) continue;
        const allowed = guard(transition);
        if (typeof allowed !== "boolean") return allowed.then((ok) => ok && apply(index));
        if (!allowed) return false;
      }
      if (state !== before) return false;
      commit?.();
      return true;
    }

    const allowed = apply(0);
    if (typeof allowed === "boolean") return allowed;
    deciding = true;
    return allowed.finally(() => {
      deciding = false;
    });
  }

  function change(next: RouteHistory<R>, kind: ChangeKind) {
    return next === state ? !deciding : confirm(next.current, kind, () => update(next));
  }

  return {
    railCollapsed: () => collapsed,
    setRailCollapsed(value) {
      if (value === collapsed) return;
      collapsed = value;
      for (const listener of railListeners) listener(value);
    },
    onRailChange(listener) {
      railListeners.add(listener);
      return () => {
        railListeners.delete(listener);
      };
    },
    onSignal(signal, listener) {
      signals.set(signal, listener);
      if (pendingSignals.delete(signal)) listener();
      return () => {
        signals.delete(signal);
      };
    },
    sendSignal(signal) {
      const listener = signals.get(signal);
      if (listener) listener();
      else pendingSignals.add(signal);
    },
    beforeNavigate(guard) {
      guards.add(guard);
      return () => {
        guards.delete(guard);
      };
    },
    confirmProjectCreation: (chooser) => confirm(chooser, "create-project"),
    visited,
    current: () => state.current,
    history: () => state,
    navigate: (route) => change(visit(state, route, routes.equals), "navigate"),
    back: () => change(stepBack(state), "back"),
    forward: () => change(stepForward(state), "forward"),
    reset: (route) => update(historyAt(route)),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    listeners: () => listeners.size,
  };
}
