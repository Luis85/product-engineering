import { inject, nextTick, onScopeDispose, provide } from "vue";
import type { InjectionKey, Ref } from "vue";
import { PROJECT_DOMAIN_MODEL } from "../../application/domain-model";
import { PROJECT_OVERVIEW } from "../../application/projects";
import { HISTORY_LIMIT } from "../../application/shell";
import type { Route } from "../../application/routes";
import { PROJECT_TRACE } from "../../application/trace";
import { useRouting } from "../shell";

type Position = {
  readonly route: Route;
  readonly control: HTMLElement | undefined;
  readonly key: string | undefined;
  readonly left: number;
  readonly top: number;
  readonly inner: { readonly key: string; readonly left: number; readonly top: number } | undefined;
};

type Citation = { readonly route: Route; readonly origin: HTMLElement | undefined };
const focusSelector = "[data-pe-focus-key]";
const scrollSelector = "[data-pe-scroll-key]";
const restoreKey: InjectionKey<(phase?: "settled" | "available") => void> = Symbol(
  "workspace-position-restore",
);
const originKey: InjectionKey<(control: HTMLElement | undefined) => void> = Symbol(
  "workspace-position-origin",
);
const previousKey: InjectionKey<() => string | undefined> = Symbol("workspace-previous-focus-key");
const routeFocusKey: InjectionKey<(control: HTMLElement) => void> = Symbol("workspace-route-focus");

export function useRestoreWorkspacePosition() {
  return inject(restoreKey, () => undefined);
}

export function useRememberWorkspaceOrigin() {
  return inject(originKey, () => undefined);
}

export function useWorkspaceOriginKey() {
  return inject(previousKey, () => undefined);
}

export function useWorkspaceRouteFocus() {
  return inject(routeFocusKey, (control) => control.focus({ preventScroll: true }));
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

function capturePosition(
  workspace: HTMLElement,
  route: Route,
  control: HTMLElement | undefined,
): Position {
  const scroll = scrollOwner(workspace);
  const region = control?.closest<HTMLElement>(scrollSelector);
  const key = region?.dataset.peScrollKey;
  return {
    route,
    control,
    key: control?.dataset.peFocusKey,
    left: scroll.scrollLeft,
    top: scroll.scrollTop,
    inner: key && region ? { key, left: region.scrollLeft, top: region.scrollTop } : undefined,
  };
}

function keepsWorkspacePosition(previous: Route, next: Route) {
  if (previous.name === "settings") return next.name === "settings";
  if (previous.name === PROJECT_TRACE || previous.name === PROJECT_OVERVIEW)
    return next.name === previous.name && next.projectId === previous.projectId;
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
  let fallbackControl: HTMLElement | undefined;
  let pendingCitation: Citation | undefined;
  let enteredByCitation = false;
  let stopCitationObserver: (() => void) | undefined;
  onScopeDispose(() => stopCitationObserver?.());

  function mountedHeading() {
    return content.value?.querySelector<HTMLElement>("h1[tabindex]");
  }

  function heading() {
    return mountedHeading() ?? content.value;
  }

  function currentPosition() {
    const route = navigation.current();
    return positions.findLast((candidate) => definition.equals(candidate.route, route));
  }
  provide(previousKey, () => (history.value.forward.length ? currentPosition()?.key : undefined));
  provide(routeFocusKey, (control) => {
    // An explicit route selection takes precedence over the heading fallback.
    restoredControl = control;
    control.focus({ preventScroll: true });
  });

  function restore(fallback = false) {
    if (enteredByCitation) {
      focusCitationHeading();
      return;
    }
    const workspace = frame.value;
    if (!workspace || restoredControl) return;
    const target = currentPosition();
    const focused = positionControl(workspace, target);
    if (!focused && !fallback) return;
    if (!focused) fallbackControl = heading();
    (focused ?? fallbackControl)?.focus({ preventScroll: true });
    restoreScroll(workspace, target);
    restoredControl = focused;
  }

  function restoreSettledScroll() {
    if (enteredByCitation) return;
    const workspace = frame.value;
    if (!workspace || !restoredControl || workspace.ownerDocument.activeElement !== restoredControl)
      return;
    const target = currentPosition();
    if (target) restoreScroll(workspace, target);
  }
  provide(restoreKey, (phase) => {
    if (phase === "settled") restoreSettledScroll();
    else if (phase !== "available" || fallbackControl?.matches(":focus")) restore();
  });
  function rememberOrigin(control: HTMLElement | undefined) {
    origin = control;
  }
  async function followCitation(route: Route, originControl?: HTMLElement) {
    const same = definition.equals(navigation.current(), route);
    const request = { route, origin: originControl };
    pendingCitation = request;
    const accepted = await navigation.navigate(route);
    if (pendingCitation === request) pendingCitation = undefined;
    if (same && accepted) heading()?.focus({ preventScroll: true });
    return accepted;
  }
  function takeCitation(route: Route) {
    const request = pendingCitation;
    if (!request || !definition.equals(request.route, route)) return;
    pendingCitation = undefined;
    return request;
  }
  function focusCitationHeading() {
    if (restoredControl?.isConnected) return true;
    const title = mountedHeading();
    if (!title) return false;
    const active = title.ownerDocument.activeElement;
    const owner = frame.value?.closest(".product-engineering-root");
    if (active?.closest('[role="dialog"][data-state="open"]') && owner?.contains(active))
      return true;
    restoredControl = title;
    title.focus({ preventScroll: true });
    return true;
  }
  function focusCitationDestination(workspace: HTMLElement) {
    restoreScroll(workspace, undefined);
    if (focusCitationHeading()) return;
    const outlet = content.value;
    const Observer = outlet?.ownerDocument.defaultView?.MutationObserver;
    outlet?.focus({ preventScroll: true });
    if (!outlet || !Observer) return;
    const observer = new Observer(() => {
      if (focusCitationHeading()) observer.disconnect();
    });
    observer.observe(outlet, { childList: true, subtree: true });
    stopCitationObserver = () => observer.disconnect();
  }
  function holdScroll() {
    const workspace = frame.value;
    if (!workspace) return () => undefined;
    const owner = scrollOwner(workspace);
    const { scrollLeft, scrollTop } = owner;
    return () => {
      owner.scrollLeft = scrollLeft;
      owner.scrollTop = scrollTop;
    };
  }
  provide(originKey, rememberOrigin);

  function recordDeparture(workspace: HTMLElement, citation: Citation | undefined) {
    const control = citation?.origin ?? origin ?? activeControl(workspace);
    positions.push(capturePosition(workspace, previous, control));
    if (positions.length > HISTORY_LIMIT) positions.shift();
    origin = undefined;
  }

  onScopeDispose(
    navigation.onChange((route) => {
      const workspace = frame.value;
      if (!workspace || definition.equals(previous, route)) return;
      const citation = takeCitation(route);
      stopCitationObserver?.();
      stopCitationObserver = undefined;
      enteredByCitation = Boolean(citation);
      recordDeparture(workspace, citation);
      restoredControl = undefined;
      fallbackControl = undefined;
      const sectionChange = keepsWorkspacePosition(previous, route);
      previous = route;
      if (sectionChange && !citation) return;
      void nextTick(() => {
        if (navigation.current() !== route) return;
        if (citation) focusCitationDestination(workspace);
        else restore(true);
      });
    }),
  );

  return {
    rememberOrigin,
    followCitation,
    holdScroll,
    focusHeading: () => heading()?.focus({ preventScroll: true }),
  };
}
