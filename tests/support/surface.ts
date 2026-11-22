import { Schema } from "effect";
import { defineComponent, h } from "vue";
import type { Component } from "vue";
import type { AppRuntime } from "../../src/application/app-services";
import type { Route } from "../../src/application/routes";
import { routesOf, settingsRoute } from "../../src/application/shell";
import { appSurface } from "../../src/presentation/app-surface";
import {
  mountSurface,
  NotFoundState,
  useHistory,
  useNavigate,
  useRoute,
} from "../../src/presentation/shell";
import { memoryNavigation } from "../../src/presentation/shell/host";
import type {
  MenuEntry,
  MemoryNavigation,
  SurfaceDefinition,
  SurfaceSection,
  ViewNavigation,
} from "../../src/presentation/shell/host";

const schema = Schema.Union([
  Schema.Struct({ name: Schema.Literal("home") }),
  Schema.Struct({ name: Schema.Literal("other") }),
  Schema.Struct({ name: Schema.Literal("item"), id: Schema.String }),
  Schema.Struct({ name: Schema.Literal("missing") }),
  settingsRoute(["one", "two", "unavailable"]),
]);

export type TestRoute = typeof schema.Type;

const routes = routesOf(schema, { name: "home" });

function fixtureScreen(id: string, text: string) {
  const component = defineComponent({
    render: () => h("p", { "data-testid": id }, text),
  });
  return () => Promise.resolve(component);
}

const item = defineComponent({
  setup() {
    const route = useRoute<TestRoute>();
    const navigate = useNavigate<TestRoute>();
    const history = useHistory();
    return () => {
      const current = route.value;
      if (current.name !== "item") return null;
      if (current.id === "unavailable") return h(NotFoundState);
      return h("div", [
        h("p", { "data-testid": "item" }, current.id),
        h(
          "button",
          { type: "button", onClick: () => navigate({ name: "item", id: "beta" }) },
          "Next record",
        ),
        h(
          "button",
          {
            type: "button",
            "aria-disabled": !history.canGoBack.value,
            onClick: () => history.back(),
          },
          "Previous record",
        ),
      ]);
    };
  },
});

const screenMap = {
  home: fixtureScreen("home", "Home"),
  other: fixtureScreen("other", "Other"),
  item: () => Promise.resolve(item),
  missing: undefined,
  settings: () =>
    import("../../src/presentation/shell").then(({ SettingsScreen }) => SettingsScreen),
};

const menu: readonly MenuEntry<TestRoute>[] = [
  { route: { name: "home" }, label: () => "Home", icon: "i-lucide-settings" },
  { route: { name: "other" }, label: () => "Other", icon: "i-lucide-settings" },
  { route: { name: "item", id: "alpha" }, label: () => "Item", icon: "i-lucide-settings" },
  { route: { name: "missing" }, label: () => "Unavailable", icon: "i-lucide-settings" },
];

const sections: readonly SurfaceSection<TestRoute>[] = [
  {
    id: "one",
    route: { name: "settings", section: "one" },
    label: () => "Section one",
    component: fixtureScreen("section-one", "First section"),
    badge: fixtureScreen("section-one-badge", "Two records"),
  },
  {
    id: "two",
    route: { name: "settings", section: "two" },
    label: () => "Section two",
    component: fixtureScreen("section-two", "Second section"),
  },
];

export function testSurface(): SurfaceDefinition<TestRoute> {
  return {
    ...routes,
    menu,
    screen: (route) => screenMap[route.name],
    context: fixtureScreen("context-probe", "Workspace context"),
    sections,
  };
}

export async function mountTest(
  root: HTMLElement,
  runtime: AppRuntime,
  options: {
    readonly initial?: TestRoute;
    readonly surface?: SurfaceDefinition<TestRoute>;
    readonly content?: Component;
  } = {},
): Promise<{ navigation: MemoryNavigation<TestRoute>; close: () => void }> {
  const surface = options.surface ?? testSurface();
  const navigation = memoryNavigation(surface, options.initial);
  const close = await mountSurface(root, runtime, {
    surface,
    navigation,
    ...(options.content ? { content: options.content } : {}),
  });
  return { navigation, close };
}

export async function mountApp(
  root: HTMLElement,
  runtime: AppRuntime,
  options: { readonly initial?: Route; readonly navigation?: ViewNavigation<Route> } = {},
) {
  const navigation = options.navigation ?? memoryNavigation(appSurface, options.initial);
  const close = await mountSurface(root, runtime, { surface: appSurface, navigation });
  return { navigation, close };
}
