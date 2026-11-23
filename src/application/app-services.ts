import type { ManagedRuntime } from "effect";
import type { AgentChat } from "./integrations";
import type { ServicesOf } from "./module";
import type { AppModule } from "./modules";
import type { NotesServices } from "./notes";
import type { ProjectFiles, ProjectIntegrationHost } from "./projects";
import type { ShellServices } from "./shell";

export type AppServices = [
  ShellServices,
  NotesServices,
  AgentChat,
  ProjectFiles,
  ProjectIntegrationHost,
  ServicesOf<AppModule>,
][number];

export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;
