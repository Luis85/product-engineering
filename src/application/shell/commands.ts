import type { PluginCommand } from "../module";
import { copyDiagnostics } from "./diagnostics";
import type { ShellCatalog } from "./i18n/catalog";
import type { ShellServices } from "./services";

export const shellCommands: readonly PluginCommand<
  { readonly shell: ShellCatalog },
  never,
  ShellServices
>[] = [
  { id: "open-view", name: ({ shell }) => shell.commands.openView, action: { _tag: "open" } },
  {
    id: "copy-diagnostics",
    name: ({ shell }) => shell.commands.copyDiagnostics,
    action: { _tag: "run", effect: copyDiagnostics },
  },
];
