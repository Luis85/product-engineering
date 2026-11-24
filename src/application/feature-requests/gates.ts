import { Effect, Result } from "effect";
import type { RequestGate } from "../../domain/feature-requests";
import type { ProjectBaseCheck, ProjectCriterion } from "../../domain/projects";
import { backlogSnapshot, inspectPbiPreparation, pbiCompanions, readPbiDetail } from "../backlog";
import type { BacklogItem, PbiDetail, PbiPreparation, PbiPreparationGap } from "../backlog";
import { captureProjectReleaseRules } from "../projects";
import type { FeatureRequest } from "./records";

const gateStatus = (condition: boolean) => (condition ? "passed" : "open");
const base = (id: ProjectBaseCheck, status: RequestGate["status"]): RequestGate => ({ id, status });
const openKinds = { "open-task": "TASK", "open-issue": "ISS", "open-bug": "BUG" } as const;

function readyCriterion(
  { id, type, title }: ProjectCriterion,
  source: PbiDetail | undefined,
  items: readonly BacklogItem[] | undefined,
  scope: string,
): RequestGate {
  if (type === "manual") return { id, title, status: "open" };
  if (type === "scope") return { id, title, status: gateStatus(Boolean(scope.trim())) };
  if (!source || !items) return { id, title, status: "unavailable" };
  const candidates =
    type === "open-work" ? items : items.filter(({ kind }) => kind === openKinds[type]);
  return { id, title, status: gateStatus(pbiCompanions(candidates, source.edit.item).open === 0) };
}

function preparationGates(preparation: PbiPreparation | undefined, approved: boolean) {
  if (!preparation) return [base("base-ready", "unavailable"), base("base-git", "unavailable")];
  const criteriaMet = preparation.prerequisites.length === 0 && approved;
  const committed =
    preparation.inputs.length > 0 &&
    preparation.inputs.every((input) => input.state === "clean" && Boolean(input.commit));
  return [base("base-ready", gateStatus(criteriaMet)), base("base-git", gateStatus(committed))];
}

export function readDraftRequestGates(record: FeatureRequest) {
  const { projectId, pbiId, scope } = record;
  return Effect.gen(function* () {
    const rules = yield* captureProjectReleaseRules(projectId);
    const pbi = yield* Effect.result(readPbiDetail(projectId, pbiId));
    const source = Result.isSuccess(pbi) ? pbi.success : undefined;
    const preparation = source ? yield* inspectPbiPreparation(source) : undefined;
    const backlog = yield* backlogSnapshot(projectId);
    const items = backlog.base && backlog.items;
    const ready = [
      ...preparationGates(preparation, source?.approval === "approved"),
      ...(rules?.ready.map((criterion) => readyCriterion(criterion, source, items, scope)) ?? []),
    ];
    const done = [
      base("base-done", "unavailable"),
      base("base-review", "unavailable"),
      ...(rules?.done.map(({ id, title }) => ({ id, title, status: "unavailable" as const })) ??
        []),
    ];
    const gaps: readonly PbiPreparationGap[] = preparation?.gaps ?? [];
    return { ready, done, gaps, rulesAvailable: rules !== undefined };
  });
}

export function requestGateProgress(gates: readonly RequestGate[] | undefined) {
  if (!gates) return;
  return { met: gates.filter(({ status }) => status === "passed").length, total: gates.length };
}
