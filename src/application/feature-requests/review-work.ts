import { Effect, Result } from "effect";
import type { RequestGate } from "../../domain/feature-requests";
import { pbiCompanions, pbiWorkIsOpen, readCurrentBacklogItems } from "../backlog";
import type { BacklogItem } from "../backlog";
import type { ProjectCriterion, ProjectId } from "../projects";
import type { RequestPackage } from "./delivery-package";
import type { ReviewWork } from "./revisions";

const workKind = { "open-task": "TASK", "open-issue": "ISS", "open-bug": "BUG" } as const;

function workRow(item: BacklogItem): ReviewWork {
  const { id, path, title, kind, state, conflict } = item;
  return { id: id ?? path, title, kind, state, ...(!id || conflict ? { issue: "identity" } : {}) };
}

function mergedWork(pbi: BacklogItem, frozen: readonly string[], backlog: readonly BacklogItem[]) {
  const scoped = new Map(
    pbiCompanions(backlog, pbi).items.map((item) => {
      const row = workRow(item);
      return [row.id, row] as const;
    }),
  );
  for (const id of frozen) {
    if (scoped.has(id)) continue;
    const item = backlog.find((entry) => entry.id === id);
    scoped.set(id, item ? workRow(item) : { id, issue: "missing" });
  }
  return [...scoped.values()].toSorted((left, right) => left.id.localeCompare(right.id));
}

export function readReviewWork(
  projectId: ProjectId,
  pbiId: string,
  frozen: readonly string[] | undefined,
) {
  return Effect.gen(function* () {
    if (!frozen) return;
    const result = yield* Effect.result(readCurrentBacklogItems(projectId));
    if (Result.isFailure(result)) return;
    const backlog = result.success;
    const pbi = backlog.find((item) => item.kind === "UC" && item.id === pbiId && !item.conflict);
    return pbi && mergedWork(pbi, frozen, backlog);
  });
}

export function reviewGateWork(
  type: ProjectCriterion["type"],
  work: readonly ReviewWork[] | undefined,
) {
  if (type === "manual" || type === "scope") return;
  if (type === "open-work") return work;
  return work?.filter(({ kind, issue }) => issue || kind === workKind[type]);
}

export function configuredReviewGate(
  { id, title, type }: ProjectCriterion,
  payload: RequestPackage | undefined,
  manual: readonly string[] | undefined,
  work: readonly ReviewWork[] | undefined,
): RequestGate {
  const selected = reviewGateWork(type, work);
  const passed =
    type === "scope"
      ? Boolean(payload?.scope.trim())
      : type === "manual"
        ? Boolean(manual?.includes(id))
        : selected?.every(({ state, issue }) => !issue && !pbiWorkIsOpen({ state: state ?? "" }));
  return { id, title, status: passed === undefined ? "unavailable" : passed ? "passed" : "open" };
}
