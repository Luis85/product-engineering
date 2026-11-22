import { Schema } from "effect";
import { ITEMS_SECTION } from "./items";
import { routeSchemasOf, sectionsOf } from "./module";
import type { RouteOf, SectionOf } from "./module";
import { APP_MODULES } from "./modules";
import type { AppModule, AppModuleName } from "./modules";
import { routesOf, SETTINGS, settingsRoute } from "./shell";

export const SETTINGS_SECTIONS = sectionsOf(APP_MODULES);
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const Route = Schema.Union([
  settingsRoute(SETTINGS_SECTIONS),
  ...routeSchemasOf(APP_MODULES),
]);
export type Route = typeof Route.Type;

export const appRoutes = routesOf(Route, { name: SETTINGS, section: ITEMS_SECTION });

type ModuleNamed<Name extends AppModuleName> = Extract<AppModule, { readonly name: Name }>;

export type RouteNameOf<Name extends AppModuleName> = [
  RouteOf<ModuleNamed<Name>>["name"],
  Name extends "shell" ? typeof SETTINGS : never,
][number];

export type SectionIdOf<Name extends AppModuleName> = SectionOf<ModuleNamed<Name>>;
