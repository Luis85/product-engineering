import { inject, nextTick, onScopeDispose, provide } from "vue";
import type { InjectionKey, Ref } from "vue";
import { PROJECT_DOMAIN_MODEL } from "../../application/domain-model";
import { HISTORY_LIMIT } from "../../application/shell";
import type { Route } from "../../application/routes";
import { useRouting } from "../shell";

type Position = {
  readonly route: Route;
  readonly control: HTMLElement | undefined;
  readonly key: string | undefined;
  readonly left: number;
  readonly top: number;
  readonly inner: { readonly key: string; readonly left: number; readonly top: number } | undefined;
};

const focusSelector = "[data-pe-focus-key]";
const scrollSelector = "[data-pe-scroll-key]";
const restoreKey: InjectionKey<(phase?: "settled") => void> = Symbol("workspace-position-restore");
const originKey: InjectionKey<(control: HTMLElement | undefined) => void> = Symbol(
  "workspace-position-origin",
);
const previousKey: InjectionKey<() => string | undefined> = Symbol("workspace-previous-focus-key");

export function useRestoreWorkspacePosition() {
  return inject(restoreKey, () => undefined);
}

export function useRememberWorkspaceOrigin() {
  return inject(originKey, () => undefined);
}

export function useWorkspaceOriginKey() {
  return inject(previousKey, () => undefined);
}

function activeControl(workspace: HTMLElement) {
  const active = workspace.ownerDocument.activeElement;
  if (active && workspace.contains(active))
    return active.closest<HTMLElement>(focusSelector) ?? undefined;
}

function positionControl(workspace: HTMLElement, target: Position | undefined) {
  if (target?.control?.isConnected) return target.control;
  if (!target?.key) return undefined;
  return [...workspace.querySelectorAll<HTMLElement>(focusSelector)].find(
    (element) => element.dataset.peFocusKey === target.key,
  );
}

function scrollOwner(element: HTMLElement) {
  const win = element.ownerDocument.defaultView;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const overflow = win?.getComputedStyle(current).overflowY;
    if (overflow === "auto" || overflow === "scroll") return current;
  }
  return element.ownerDocument.scrollingElement ?? element;
}

function restoreScroll(workspace: HTMLElement, target: Position | undefined) {
  const scroll = scrollOwner(workspace);
  scroll.scrollLeft = target?.left ?? 0;
  scroll.scrollTop = target?.top ?? 0;
  if (target?.inner) {
    const region = Array.from(workspace.querySelectorAll<HTMLElement>(scrollSelector)).find(
      (element) => element.dataset.peScrollKey === target.inner?.key,
    );
    if (region) {
      region.scrollLeft = target.inner.left;
      region.scrollTop = target.inner.top;
    }
  }
}

function keepsWorkspacePosition(previous: Route, next: Route) {
  if (previous.name === "settings") return next.name === "settings";
  return (
    previous.name === PROJECT_DOMAIN_MODEL &&
    next.name === PROJECT_DOMAIN_MODEL &&
    previous.projectId === next.projectId
  );
}

export function useWorkspacePosition(
  frame: Ref<HTMLElement | undefined>,
  content: Ref<HTMLElement | undefined>,
) {
  const { definition, history, navigation } = useRouting();
  let previous = navigation.current();
  let origin: HTMLElement | undefined;
  const positions: Position[] = [];
  let restoredControl: HTMLElement | undefined;

  function heading() {
    return content.value?.querySelector<HTMLElement>("h1[tabindex]") ?? content.value;
  }

  function currentPosition() {
    const route = navigation.current();
    return positions.findLast((candidate) => definition.equals(candidate.route, route));
  }
  provide(previousKey, () => (history.value.forward.length ? currentPosition()?.key : undefined));

  function restore(fallback = false) {
    const workspace = frame.value;
    if (!workspace || restoredControl) return;
    const target = currentPosition();
    const focused = positionControl(workspace, target);
    if (!focused && !fallback) return;
    (focused ?? heading())?.focus({ preventScroll: true });
    restoreScroll(workspace, target);
    restoredControl = focused;
  }

  function restoreSettledScroll() {
    const workspace = frame.value;
    if (!workspace || !restoredControl || workspace.ownerDocument.activeElement !== restoredControl)
      return;
    const target = currentPosition();
    if (target) restoreScroll(workspace, target);
  }
  provide(restoreKey, (phase) => {
    if (phase === "settled") restoreSettledScroll();
    else restore();
  });
  function rememberOrigin(control: HTMLElement | undefined) {
    origin = control;
  }
  provide(originKey, rememberOrigin);

  onScopeDispose(
    navigation.onChange((route) => {
      const workspace = frame.value;
      if (!workspace || definition.equals(previous, route)) return;
      const scroll = scrollOwner(workspace);
      const control = origin ?? activeControl(workspace);
      const region = control?.closest<HTMLElement>(scrollSelector);
      const key = region?.dataset.peScrollKey;
      positions.push({
        route: previous,
        control,
        key: control?.dataset.peFocusKey,
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
        inner: key && region ? { key, left: region.scrollLeft, top: region.scrollTop } : undefined,
      });
      if (positions.length > HISTORY_LIMIT) positions.shift();
      origin = undefined;
      restoredControl = undefined;
      const sectionChange = keepsWorkspacePosition(previous, route);
      previous = route;
      if (sectionChange) return;
      void nextTick(() => {
        if (navigation.current() === route) restore(true);
      });
    }),
  );

  return {
    rememberOrigin,
    focusHeading: () => heading()?.focus({ preventScroll: true }),
  };
}
