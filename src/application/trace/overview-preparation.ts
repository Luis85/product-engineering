import { Effect } from "effect";
import { indexedPbiSources, inspectIndexedPbiPreparation, pbiSourceDraft } from "../backlog";
import type { BacklogItem, PbiPreparationGap } from "../backlog";
import { knowledgeSnapshot, projectKnowledge } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import { projectById } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import type { Route } from "../routes";
import { isCanonicalStoryItem } from "../story-maps";
import { tracePbiDestination, traceRequirement } from "./source";

type Preparation = {
  readonly destination: Route;
  readonly reason?: PbiPreparationGap["reason"] | "identity" | "unavailable";
};

export type OverviewPreparation = ReadonlyMap<string, Preparation>;

function preparePbi(
  project: ProjectId,
  item: BacklogItem,
  records: ReadonlyMap<string, KnowledgeRecord>,
  vision: KnowledgeRecord | undefined,
  settings: ProjectSettings | undefined,
) {
  return Effect.gen(function* () {
    if (!isCanonicalStoryItem(item) || item.fields.project_id !== project)
      return {
        destination: tracePbiDestination(project, item),
        reason: "identity",
      } satisfies Preparation;
    const destination = tracePbiDestination(project, item, item.id);
    const sources = indexedPbiSources(project, item.fields, records);
    const prd = sources.find(({ kind }) => kind === "prd")?.record;
    if (!traceRequirement(prd, pbiSourceDraft(item.fields).pbi_requirement_id))
      return { destination, reason: "prd" } satisfies Preparation;
    const reason = yield* inspectIndexedPbiPreparation(item, sources, records, vision, settings);
    return { destination, ...(reason && { reason }) } satisfies Preparation;
  });
}

export function readOverviewPreparation(project: ProjectId, items: readonly BacklogItem[]) {
  return Effect.gen(function* () {
    const settings = yield* projectById(project);
    const { records } = yield* knowledgeSnapshot;
    const scoped = projectKnowledge(project, records);
    const indexed = new Map(scoped.map((record) => [record.id, record]));
    const visions = scoped.filter(({ kind }) => kind === "vision");
    const vision = visions.find(({ values }) => values.approval === "approved") ?? visions[0];
    const entries = yield* Effect.forEach(
      items,
      (item) =>
        Effect.map(
          preparePbi(project, item, indexed, vision, settings),
          (state) => [item.key, state] as const,
        ),
      { concurrency: 3 },
    );
    return new Map(entries);
  });
}
