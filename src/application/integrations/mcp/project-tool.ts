import { Schema } from "effect";
import { projectDataClassSchema, projectIdSchema } from "../../../domain/projects";
import type { ProjectDataClass, ProjectId } from "../../../domain/projects";
import { defineLocalMcpTool } from "./index";

export type ReadMcpProject = (
  id: ProjectId,
  signal: AbortSignal,
) => Promise<ProjectMcpCandidate | undefined>;
export type ProjectMcpCandidate = {
  readonly id: ProjectId;
  readonly name: string;
  readonly repository: string;
  readonly branch: string;
  readonly dataClass: ProjectDataClass | undefined;
  readonly mcpRead: boolean;
};
export type ProjectMcpProbe = "stopped" | "allowed" | "denied" | "unavailable";
export const projectMcpToolName = "get_project";
const output = Schema.Struct({
  id: projectIdSchema,
  name: Schema.NonEmptyString,
  repository: Schema.NonEmptyString,
  branch: Schema.NonEmptyString,
  dataClass: projectDataClassSchema,
});

export function projectReadTool(read: ReadMcpProject) {
  return defineLocalMcpTool({
    name: projectMcpToolName,
    description: "Read delivery metadata from a project explicitly shared by the user.",
    readOnly: true,
    inputSchema: Schema.Struct({ projectId: projectIdSchema }),
    outputSchema: output,
    run: async ({ projectId }, signal) => {
      signal.throwIfAborted();
      const project = await read(projectId, signal);
      signal.throwIfAborted();
      if (
        project?.id !== projectId ||
        !project.mcpRead ||
        !project.repository ||
        !project.dataClass
      ) {
        return { success: false, message: "Project is not available." };
      }
      const { id, name, repository, branch, dataClass } = project;
      return { success: true, value: { id, name, repository, branch, dataClass } };
    },
  });
}
