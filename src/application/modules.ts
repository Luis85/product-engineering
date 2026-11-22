import { integrationsModule } from "./integrations";
import { shellModule } from "./shell";

export const APP_MODULES = [shellModule, integrationsModule] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
