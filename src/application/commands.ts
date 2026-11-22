import type { AppServices } from "./app-services";
import type { Catalog } from "./messages";
import { commandsOf } from "./module";
import type { PluginCommand } from "./module";
import { APP_MODULES } from "./modules";
export type AppCommand = PluginCommand<Catalog, never, AppServices>;

export const appCommands: readonly AppCommand[] = commandsOf(APP_MODULES);
