import { shellModule } from "./shell";

export const APP_MODULES = [shellModule] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type AppModuleName = AppModule["name"];
