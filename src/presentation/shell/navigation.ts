import { computed, inject, shallowRef } from "vue";
import type { App, InjectionKey, ShallowRef } from "vue";
import type { Route } from "../../application/routes";
import type { RouteHistory, RouteLike } from "../../application/shell";
import type { SurfaceDefinition, ViewNavigation } from "./routing";

type Routing<R extends RouteLike> = {
  readonly definition: SurfaceDefinition<R>;
  readonly navigation: ViewNavigation<R>;
  readonly history: Readonly<ShallowRef<RouteHistory<R>>>;
};

const routingKey: InjectionKey<unknown> = Symbol("surface-routing");

export function provideRouting<R extends RouteLike>(
  app: App,
  definition: SurfaceDefinition<R>,
  navigation: ViewNavigation<R>,
): () => void {
  const history = shallowRef(navigation.history());
  app.provide(routingKey, { definition, navigation, history } satisfies Routing<R>);
  return navigation.onChange(() => {
    history.value = navigation.history();
  });
}

export function useRouting<R extends RouteLike = Route>(): Routing<R> {
  const routing = inject(routingKey);
  if (!routing) throw new Error("Routing is only available inside a routed surface");
  // A mounted surface and its screens share one route type. Vue's key is shared across surfaces.
  return routing as Routing<R>;
}

export function useRoute<R extends RouteLike = Route>() {
  const { history } = useRouting<R>();
  return computed(() => history.value.current);
}

export function useNavigate<R extends RouteLike = Route>(): (route: R) => void {
  const { navigation } = useRouting<R>();
  return (route) => navigation.navigate(route);
}

export function useHistory() {
  const { history, navigation } = useRouting();
  const canGoBack = computed(() => history.value.back.length > 0);
  const canGoForward = computed(() => history.value.forward.length > 0);
  return {
    canGoBack,
    canGoForward,
    back() {
      if (canGoBack.value) navigation.back();
    },
    forward() {
      if (canGoForward.value) navigation.forward();
    },
  };
}
