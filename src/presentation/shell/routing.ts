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
  readonly navigate: (route: R) => void;
  readonly back: () => void;
  readonly forward: () => void;
  readonly onChange: (listener: (route: R) => void) => () => void;
};

export type MemoryNavigation<R extends RouteLike> = ViewNavigation<R> & {
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

  function update(next: RouteHistory<R>): void {
    if (next === state) return;
    state = next;
    visited.push(state.current);
    if (visited.length > HISTORY_LIMIT + 1) visited.shift();
    for (const listener of listeners) listener(state.current);
  }

  return {
    visited,
    current: () => state.current,
    history: () => state,
    navigate: (route) => update(visit(state, route, routes.equals)),
    back: () => update(stepBack(state)),
    forward: () => update(stepForward(state)),
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
