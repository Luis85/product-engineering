import ui from "@nuxt/ui/vue-plugin";
import { createApp } from "vue";
import type { Component } from "vue";
import type { AppRuntime } from "../../application/app-services";
import ShellApp from "./components/ShellApp.vue";
import { keepIconsOffline } from "./icons-offline";
import { releaseAll } from "./release";
import { provideRuntime, reportVueError } from "./runtime/use-runtime";
import { PORTAL_CLASS, SCOPE_CLASS } from "./scope";
import { bindHostTheme } from "./theme";

type SurfaceOptions = {
  readonly content: Component;
};

export async function mountSurface(
  root: HTMLElement,
  runtime: AppRuntime,
  { content }: SurfaceOptions,
): Promise<() => void> {
  await runtime.context();

  const alreadyScoped = root.classList.contains(SCOPE_CLASS);
  root.classList.add(SCOPE_CLASS);
  const releases: (() => void)[] = [() => root.classList.toggle(SCOPE_CLASS, alreadyScoped)];
  const close = () => releaseAll(releases.splice(0));

  try {
    releases.push(bindHostTheme(root));
    const owner = root.ownerDocument;
    const mountPoint = owner.createElement("div");
    const portal = owner.createElement("div");
    portal.classList.add(PORTAL_CLASS);
    releases.push(
      () => mountPoint.remove(),
      () => portal.remove(),
    );
    root.append(mountPoint, portal);

    const app = createApp(ShellApp, { portal, content });
    app.config.idPrefix = crypto.randomUUID();
    app.config.errorHandler = (cause) => reportVueError(runtime, cause);
    provideRuntime(app, runtime);
    keepIconsOffline();
    app.use(ui);
    app.mount(mountPoint);
    releases.push(() => app.unmount());
    return close;
  } catch (cause) {
    close();
    throw cause;
  }
}
