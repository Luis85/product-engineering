import type { Catalog } from "./messages";
import { commandsOf } from "./module";
import type { PluginCommand } from "./module";
import { APP_MODULES } from "./modules";
import type { ShellServices } from "./shell";

export type AppCommand = PluginCommand<Catalog, never, ShellServices>;

export const appCommands: readonly AppCommand[] = commandsOf(APP_MODULES);
