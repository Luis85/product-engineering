import { createApp, defineComponent } from "vue";
import type { VNodeChild } from "vue";
import type { AppRuntime } from "../../src/application/app-services";
import { provideRuntime } from "../../src/presentation/shell/runtime/use-runtime";

export function mountComposable<A>(
  runtime: AppRuntime,
  create: () => A,
  render?: (result: A) => VNodeChild,
) {
  let result: { readonly value: A } | undefined;
  const app = createApp(
    defineComponent({
      setup() {
        const value = create();
        result = { value };
        return () => render?.(value) ?? null;
      },
    }),
  );
  provideRuntime(app, runtime);
  const root = document.createElement("div");
  app.mount(root);
  if (!result) throw new Error("The composable did not run");

  let active = true;
  const close = () => {
    if (!active) return;
    active = false;
    app.unmount();
  };
  return { result: result.value, root, close };
}
