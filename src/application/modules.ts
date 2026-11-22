import { integrationsModule } from "./integrations";
import { itemsModule } from "./items";
import { shellModule } from "./shell";

export const APP_MODULES = [shellModule, itemsModule, integrationsModule] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
