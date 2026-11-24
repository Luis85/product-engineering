import type { BoardStage } from "../../domain/backlog";
import { normalizedBoardStage } from "../../domain/backlog";
import type { ProjectId } from "../projects";
import type { BacklogItem } from "./model";

type BoardRequestState =
  | "draft"
  | "released"
  | "queued"
  | "running"
  | "clarification"
  | "failed"
  | "review"
  | "changes-requested"
  | "accepted"
  | "closed";

export type BoardRequest = {
  readonly projectId: ProjectId;
  readonly pbiId: string;
  readonly id: string;
  readonly title: string;
  readonly state: BoardRequestState;
  readonly sequence: number;
  readonly runId?: string;
};

export type BoardRequestHandoff = {
  readonly active?: BoardRequest;
  readonly previous: readonly BoardRequest[];
  readonly development?: BoardRequest;
};

export function boardRequestHandoff(
  projectId: ProjectId,
  pbiId: string,
  requests: readonly BoardRequest[],
): BoardRequestHandoff {
  const linked = requests
    .filter((entry) => entry.projectId === projectId && entry.pbiId === pbiId)
    .toSorted((a, b) => b.sequence - a.sequence || a.id.localeCompare(b.id));
  const unique = new Map<string, BoardRequest>();
  for (const entry of linked) if (!unique.has(entry.id)) unique.set(entry.id, entry);
  const current = [...unique.values()];
  const active = current.find(({ state }) => state !== "accepted" && state !== "closed");
  const development = current.find(projectsDevelopment);
  return {
    ...(active && { active }),
    previous: current.filter((entry) => entry !== active),
    ...(development && { development }),
  };
}

export function pbiBoardStage(
  item: Pick<BacklogItem, "state" | "fields">,
  handoff?: BoardRequestHandoff,
): BoardStage {
  const stage = normalizedBoardStage(item.state) ?? "Backlog";
  if (stage === "Done" || item.fields.pbi_stage_choice === stage) return stage;
  return handoff?.development ? "In Development" : stage;
}

function projectsDevelopment({ state, runId }: BoardRequest) {
  return (
    state === "queued" ||
    state === "running" ||
    state === "clarification" ||
    state === "failed" ||
    state === "review" ||
    (state === "changes-requested" && Boolean(runId))
  );
}

export function boardRequestDestination(
  projectId: ProjectId,
  pbiId: string,
  active?: BoardRequest,
) {
  return active
    ? { kind: "open-request" as const, projectId, pbiId, requestId: active.id }
    : { kind: "create-request" as const, projectId, pbiId };
}
