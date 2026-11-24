import ui from "@nuxt/ui/vite";
import vue from "@vitejs/plugin-vue";
import { noHeadPlugins } from "../scripts/no-head-plugins.mjs";
import { scopeCss } from "../scripts/scope-css.mjs";

export const PLUGIN_ID = "product-engineering";
export const CSS_PREFIX = "pe";
export const SHELL_ICONS: readonly string[] = [
  "lucide:book-open",
  "lucide:arrow-left",
  "lucide:arrow-right",
  "lucide:arrow-down",
  "lucide:arrow-up",
  "lucide:check",
  "lucide:circle",
  "lucide:circle-help",
  "lucide:clock",
  "lucide:code",
  "lucide:eye",
  "lucide:plus",
  "lucide:user",
  "lucide:circle-x",
  "lucide:chevron-down",
  "lucide:chevron-right",
  "lucide:folder",
  "lucide:flag",
  "lucide:layout-grid",
  "lucide:link",
  "lucide:list-tree",
  "lucide:menu",
  "lucide:map",
  "lucide:network",
  "lucide:panel-left-close",
  "lucide:panel-left-open",
  "lucide:search",
  "lucide:sliders-horizontal",
  "lucide:info",
  "lucide:loader-circle",
  "lucide:message-square",
  "lucide:settings",
  "lucide:triangle-alert",
];

export function sharedConfig({
  mode,
  skipScope,
}: {
  readonly mode: string;
  readonly skipScope?: (file: string) => boolean;
}) {
  const environment = mode === "development" || mode === "test" ? mode : "production";
  return {
    plugins: [
      noHeadPlugins(),
      vue(),
      ui({
        router: false,
        colorMode: false,
        autoImport: false,
        components: false,
        theme: { prefix: CSS_PREFIX },
        icon: { mode: "svg", clientBundle: { icons: [...SHELL_ICONS] } },
      }),
    ],
    css: {
      postcss: {
        plugins: [
          scopeCss({ id: PLUGIN_ID, prefix: CSS_PREFIX, ...(skipScope && { skip: skipScope }) }),
        ],
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(environment),
      "import.meta.dev": "false",
      __VUE_OPTIONS_API__: "true",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
  };
}
