import { Effect, Result, Stream } from "effect";
import type { DeliveryStage } from "../../domain/feature-requests";
import type { ProjectId } from "../projects";
import { verifyRequestPackage } from "./delivery-package";
import { featureRequestsChanges, featureRequestStageCounts, requestDeliveryStage } from "./records";
import type { FeatureRequest } from "./records";
import { readFeatureRequestBaseline, requestInputChanges } from "./release";
import { readReviewActionBlocker } from "./review-decision";
import { featureRequestRevision } from "./revisions";

export type RequestStageEntry = {
  readonly record: FeatureRequest;
  readonly stage: DeliveryStage;
  readonly reviewBlocker?: NonNullable<Effect.Success<ReturnType<typeof readReviewActionBlocker>>>;
  readonly blocker?: NonNullable<FeatureRequest["blocker"]>;
};

export type RequestStageProjection = {
  readonly ready: boolean;
  readonly failed: boolean;
  readonly entries: readonly RequestStageEntry[];
  readonly counts: ReadonlyMap<DeliveryStage, number>;
};

export const initialRequestStages: RequestStageProjection = {
  ready: false,
  failed: false,
  entries: [],
  counts: featureRequestStageCounts([]),
};

function releasedBlocker(record: FeatureRequest) {
  return Effect.gen(function* () {
    const entry = featureRequestRevision(record, record.revision);
    if (!entry?.package || entry.run) return "dispatch-evidence" as const;
    const verified = yield* Effect.result(verifyRequestPackage(entry.package));
    if (Result.isFailure(verified)) return "dispatch-evidence" as const;
    const baseline = yield* Effect.result(readFeatureRequestBaseline(record));
    if (Result.isFailure(baseline) || !baseline.success || baseline.success.stale)
      return "stale-inputs" as const;
  });
}

function stageEntry(
  record: FeatureRequest,
): Effect.Effect<
  RequestStageEntry,
  never,
  Effect.Services<ReturnType<typeof readReviewActionBlocker>>
> {
  const stage = requestDeliveryStage(record);
  if (stage === "review") {
    // Legacy rows retain their indexed phase even when there is no decision receipt to open.
    if (!record.deliveryData) return Effect.succeed({ record, stage, reviewBlocker: "commit" });
    return Effect.map(readReviewActionBlocker(record), (reviewBlocker) =>
      reviewBlocker ? { record, stage: "blocked", reviewBlocker } : { record, stage },
    );
  }
  if (stage === "ready" && record.deliveryData) {
    return Effect.map(releasedBlocker(record), (blocker) =>
      blocker ? { record, stage: "blocked", blocker } : { record, stage },
    );
  }
  return Effect.succeed({ record, stage, ...(record.blocker && { blocker: record.blocker }) });
}

export function requestStageChanges(projectId: ProjectId) {
  return Stream.zipLatestAll(
    featureRequestsChanges(projectId),
    Stream.concat(Stream.succeed(undefined), requestInputChanges(projectId)),
  ).pipe(
    Stream.mapEffect(([{ records, ready, failed }]) =>
      Effect.map(Effect.forEach(records, stageEntry, { concurrency: 4 }), (entries) => {
        const stages = new Map(entries.map(({ record, stage }) => [record.id, stage]));
        return {
          ready,
          failed,
          entries,
          counts: featureRequestStageCounts(
            records,
            (record) => stages.get(record.id) ?? requestDeliveryStage(record),
          ),
        } satisfies RequestStageProjection;
      }),
    ),
  );
}
