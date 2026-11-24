import { Context, Effect, Layer } from "effect";
import type { ProjectId } from "../../domain/projects";
import type { ChatProvider, ProjectMcpProbe } from "../integrations";
import { ProjectIntegrationError } from "./errors";

export class ProjectIntegrationHost extends Context.Service<
  ProjectIntegrationHost,
  {
    readonly probe: (projectId: ProjectId) => Effect.Effect<ProjectMcpProbe>;
    readonly openSettings: (
      provider?: ChatProvider,
    ) => Effect.Effect<void, ProjectIntegrationError>;
  }
>()("product-engineering/application/ProjectIntegrationHost") {}

export const unavailableProjectIntegrationHost = Layer.succeed(ProjectIntegrationHost, {
  probe: () => Effect.succeed("unavailable"),
  openSettings: () => Effect.fail(new ProjectIntegrationError({ reason: "settings" })),
});

export const testProjectMcpRead = (projectId: ProjectId) =>
  ProjectIntegrationHost.use((host) => host.probe(projectId));
export const openProjectIntegrationSettings = (provider?: ChatProvider) =>
  ProjectIntegrationHost.use((host) => host.openSettings(provider));
