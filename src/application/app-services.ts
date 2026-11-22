import type { ManagedRuntime } from "effect";
import type { ServicesOf } from "./module";
import type { AppModule } from "./modules";
import type { ShellServices } from "./shell";

export type AppServices = [ShellServices, ServicesOf<AppModule>][number];

export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;
