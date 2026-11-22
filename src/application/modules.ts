import { integrationsModule } from "./integrations";
import { itemsModule } from "./items";
import { notesModule } from "./notes";
import { shellModule } from "./shell";

export const APP_MODULES = [shellModule, notesModule, itemsModule, integrationsModule] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
