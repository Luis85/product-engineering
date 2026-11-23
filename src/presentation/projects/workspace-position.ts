import { nextTick, onScopeDispose } from "vue";
import type { Ref } from "vue";
import { HISTORY_LIMIT } from "../../application/shell";
import type { Route } from "../../application/routes";
import { useRouting } from "../shell";

type Position = {
  readonly route: Route;
  readonly control: HTMLElement | undefined;
  readonly key: string | undefined;
  readonly left: number;
  readonly top: number;
};

const focusSelector = "[data-pe-focus-key]";

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

export function useWorkspacePosition(
  frame: Ref<HTMLElement | undefined>,
  content: Ref<HTMLElement | undefined>,
) {
  const { definition, navigation } = useRouting();
  let previous = navigation.current();
  let origin: HTMLElement | undefined;
  const positions: Position[] = [];

  function heading() {
    return content.value?.querySelector<HTMLElement>("h1[tabindex]") ?? content.value;
  }

  onScopeDispose(
    navigation.onChange((route) => {
      const workspace = frame.value;
      if (!workspace || definition.equals(previous, route)) return;
      const scroll = scrollOwner(workspace);
      const control = origin ?? activeControl(workspace);
      positions.push({
        route: previous,
        control,
        key: control?.dataset.peFocusKey,
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      });
      if (positions.length > HISTORY_LIMIT) positions.shift();
      origin = undefined;
      const sectionChange = previous.name === "settings" && route.name === "settings";
      previous = route;
      if (sectionChange) return;
      const target = positions.findLast((candidate) => definition.equals(candidate.route, route));
      void nextTick(() => {
        if (navigation.current() !== route) return;
        const focused = positionControl(workspace, target) ?? heading();
        focused?.focus({ preventScroll: true });
        scroll.scrollLeft = target?.left ?? 0;
        scroll.scrollTop = target?.top ?? 0;
      });
    }),
  );

  return {
    rememberOrigin: (control: HTMLElement | undefined) => {
      origin = control;
    },
    focusHeading: () => heading()?.focus({ preventScroll: true }),
  };
}
