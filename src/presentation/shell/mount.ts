import ui from "@nuxt/ui/vue-plugin";
import { createApp } from "vue";
import type { Component } from "vue";
import type { AppRuntime } from "../../application/app-services";
import type { RouteLike } from "../../application/shell";
import ShellApp from "./components/ShellApp.vue";
import { keepIconsOffline } from "./icons-offline";
import { markdownHostKey } from "./markdown-host";
import type { MarkdownHost } from "./markdown-host";
import { provideRouting } from "./navigation";
import { releaseAll } from "./release";
import type { SurfaceDefinition, ViewNavigation } from "./routing";
import { provideRuntime, reportVueError } from "./runtime/use-runtime";
import { PORTAL_CLASS, SCOPE_CLASS } from "./scope";
import { bindHostTheme } from "./theme";

type SurfaceOptions<R extends RouteLike> = { readonly markdownHost?: MarkdownHost } & (
  | { readonly content: Component; readonly surface?: never; readonly navigation?: never }
  | {
      readonly content?: Component;
      readonly surface: SurfaceDefinition<R>;
      readonly navigation: ViewNavigation<R>;
    }
);

export async function mountSurface<R extends RouteLike>(
  root: HTMLElement,
  runtime: AppRuntime,
  { content, surface, navigation, markdownHost }: SurfaceOptions<R>,
): Promise<() => void> {
  await runtime.context();

  const scopes = surface?.frame ? [SCOPE_CLASS, "pe-project-shell"] : [SCOPE_CLASS];
  const addedScopes = scopes.filter((scope) => !root.classList.contains(scope));
  root.classList.add(...addedScopes);
  const releases: (() => void)[] = [() => root.classList.remove(...addedScopes)];
  const close = () => releaseAll(releases.splice(0));

  try {
    releases.push(bindHostTheme(root));
    const owner = root.ownerDocument;
    const mountPoint = owner.createElement("div");
    const portal = owner.createElement("div");
    mountPoint.classList.add("pe-surface-mount");
    portal.classList.add(PORTAL_CLASS);
    releases.push(
      () => mountPoint.remove(),
      () => portal.remove(),
    );
    root.append(mountPoint, portal);

    const app = createApp(ShellApp, { portal, ...(content === undefined ? {} : { content }) });
    app.config.idPrefix = crypto.randomUUID();
    app.config.errorHandler = (cause) => reportVueError(runtime, cause);
    provideRuntime(app, runtime);
    if (markdownHost) app.provide(markdownHostKey, markdownHost);
    if (surface) releases.push(provideRouting(app, surface, navigation));
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
