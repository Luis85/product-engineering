import { Effect } from "effect";
import {
  backlogRoute,
  backlogSnapshot,
  pbiDetailRoute,
  pbiSourceDraft,
  readPbiDetail,
} from "../backlog";
import type { BacklogItem, PbiDetail } from "../backlog";
import { inspectArtifactGit } from "../git";
import { knowledgeDetailRoute, knowledgeGitSource, resolveKnowledgeNote } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import type { ProjectId } from "../projects";
import { isCanonicalStoryItem, storyMapItemBacklinks, storyMapsSnapshot } from "../story-maps";

export function tracePbiOptions(items: readonly BacklogItem[]) {
  return items.filter(({ kind }) => kind === "UC");
}

function knowledgeProof(projectId: ProjectId, record: KnowledgeRecord | undefined) {
  if (!record) return Effect.succeed(undefined);
  const route = knowledgeDetailRoute(projectId, record.id, { section: "trace" });
  return Effect.match(inspectArtifactGit(knowledgeGitSource(route)), {
    onSuccess: (journal) => ({ record, route, commit: journal.revisions[0]?.oid }),
    onFailure: () => ({ record, route, commit: undefined }),
  });
}

type KnowledgeProof = NonNullable<Effect.Success<ReturnType<typeof knowledgeProof>>>;

function pbiSources(detail: PbiDetail | undefined) {
  const research = detail?.sources.find(({ kind }) => kind === "research")?.record;
  const job = detail?.sources.find(({ kind }) => kind === "jtbd")?.record;
  const prd = detail?.sources.find(({ kind }) => kind === "prd")?.record;
  const requirementId = detail && pbiSourceDraft(detail.edit.item.fields).pbi_requirement_id;
  const requirement =
    requirementId && prd?.values.requirement_id === requirementId
      ? { prd, id: requirementId }
      : undefined;
  return { research, job, prd, requirement };
}

function linkedVision(projectId: ProjectId, prd: KnowledgeRecord | undefined) {
  const visionId = prd?.values.vision_id;
  if (!visionId) return Effect.succeed(undefined);
  return Effect.map(resolveKnowledgeNote(projectId, visionId), (record) =>
    record?.kind === "vision" ? record : undefined,
  );
}

function mapOrigins(projectId: ProjectId, detail: PbiDetail | undefined) {
  if (!detail) return Effect.succeed([]);
  return Effect.map(storyMapsSnapshot(projectId), ({ maps }) =>
    storyMapItemBacklinks(projectId, detail.pbiId, maps).map(({ map, card }) => ({
      map,
      card,
      slice: map.slices.find(({ id }) => id === card.sliceId),
    })),
  );
}

type TraceSourceGap = "identity" | "research" | "job" | "vision" | "requirement" | "map";

function sourceGaps(
  detail: PbiDetail | undefined,
  research: KnowledgeProof | undefined,
  job: KnowledgeProof | undefined,
  vision: KnowledgeProof | undefined,
  requirement: KnowledgeProof | undefined,
  maps: Effect.Success<ReturnType<typeof mapOrigins>>,
): readonly TraceSourceGap[] {
  if (!detail) return ["identity"];
  return [
    ...(!research ? ["research" as const] : []),
    ...(!job ? ["job" as const] : []),
    ...(!requirement ? ["requirement" as const] : []),
    ...(!vision ? ["vision" as const] : []),
    ...(!maps.length ? ["map" as const] : []),
  ];
}

export function readTraceSources(projectId: ProjectId, pbiKey: string) {
  return Effect.gen(function* () {
    const { items } = yield* backlogSnapshot(projectId);
    const item = tracePbiOptions(items).find(({ key }) => key === pbiKey);
    if (!item) return;
    const detail = isCanonicalStoryItem(item)
      ? yield* readPbiDetail(projectId, item.id).pipe(
          Effect.catchTag("BacklogError", () => Effect.succeed(undefined)),
        )
      : undefined;
    const links = pbiSources(detail);
    const [research, job, vision, requirement, maps] = yield* Effect.all(
      [
        knowledgeProof(projectId, links.research),
        knowledgeProof(projectId, links.job),
        Effect.flatMap(linkedVision(projectId, links.prd), (record) =>
          knowledgeProof(projectId, record),
        ),
        knowledgeProof(projectId, links.requirement?.prd),
        mapOrigins(projectId, detail),
      ],
      { concurrency: 5 },
    );
    return {
      item,
      detail,
      research,
      job,
      vision,
      requirement: requirement && links.requirement && { ...requirement, id: links.requirement.id },
      maps,
      gaps: sourceGaps(detail, research, job, vision, requirement, maps),
      pbiRoute: detail
        ? pbiDetailRoute(projectId, detail.pbiId)
        : backlogRoute(projectId, item.conflict ? undefined : item.id),
    };
  });
}

export type TraceSources = NonNullable<Effect.Success<ReturnType<typeof readTraceSources>>>;
