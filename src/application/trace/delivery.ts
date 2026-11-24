import { Effect } from "effect";
import type { PbiCriterion } from "../../domain/backlog";
import type { PbiDetail } from "../backlog";
import {
  featureRequestReview,
  featureRequestRevisions,
  featureRequestsForPbi,
  featureRequestsSnapshot,
  readReviewWorkspace,
} from "../feature-requests";
import type { FeatureRequest, ReviewWorkspace } from "../feature-requests";

type Criterion = Pick<PbiCriterion, "id" | "text" | "scenario_id">;
export type TraceCriterion = Criterion & {
  readonly confirmed?: boolean;
  readonly ci?: ReviewWorkspace["ciChecks"][number] | undefined;
};

function matchedChecks(criterion: Criterion, review: ReviewWorkspace) {
  const commit = review.target?.commit;
  const matches = review.ciChecks.filter(
    ({ criterionId, scenarioId, commit: tested }) =>
      Boolean(commit) &&
      tested === commit &&
      criterionId === criterion.id &&
      scenarioId === criterion.scenario_id,
  );
  if (matches.length !== 1) return;
  const check = matches[0];
  return review.ciChecks.filter(({ checkId }) => checkId === check?.checkId).length === 1
    ? check
    : undefined;
}

function evidenceCriteria(review: ReviewWorkspace): readonly TraceCriterion[] {
  return review.criteria.map((criterion) => ({
    ...criterion,
    ci: matchedChecks(criterion, review),
  }));
}

function attributableDecision(review: ReviewWorkspace) {
  const { entry, target } = review;
  const decision = entry.decision;
  if (
    target &&
    decision &&
    (decision.decision === "changes-requested" || (review.ciPassed && review.technicalApproved))
  )
    return { state: decision.decision, reason: decision.explanation } as const;
  const scoped = featureRequestReview(review.record, entry.revision);
  const event = scoped?.evidence.events.findLast(({ kind }) => kind === "scope-change");
  if (scoped?.row.business === "changes-requested" && event?.kind === "scope-change")
    return { state: "changes-requested", reason: event.reply } as const;
}

function checkedReview(record: FeatureRequest, revision: number) {
  return Effect.map(readReviewWorkspace(record.projectId, record.id, revision), (review) => {
    if (review?.record.pbiId !== record.pbiId) return;
    const pbi = review.entry.package?.package.useCase;
    if (pbi && pbi.id !== record.pbiId) return;
    return review;
  });
}

function earlierEvidence(records: readonly FeatureRequest[], current: FeatureRequest) {
  return Effect.gen(function* () {
    for (const record of records) {
      const history = featureRequestRevisions(record).toSorted((a, b) => b - a);
      const revisions = record.id === current.id ? history : [record.revision, ...history];
      for (const revision of revisions) {
        if (!featureRequestReview(record, revision)?.row.testedCommit) continue;
        const review = yield* checkedReview(record, revision);
        if (review?.target) return review;
      }
    }
  });
}

export function readTraceDelivery(detail: PbiDetail) {
  return Effect.gen(function* () {
    const { projectId, pbiId } = detail;
    const { records } = yield* featureRequestsSnapshot(projectId);
    const { active, previous } = featureRequestsForPbi(projectId, pbiId, records);
    const ordered = (active ? [active, ...previous] : previous).toSorted(
      (a, b) => b.sequence - a.sequence || a.id.localeCompare(b.id),
    );
    const request = ordered[0];
    if (!request) return;
    const review = yield* checkedReview(request, request.revision);
    if (!review?.entry.isCurrent) return;
    const tested = Boolean(review.target);
    const earlier = tested ? undefined : yield* earlierEvidence(ordered, review.record);
    return {
      request: review.record,
      review,
      decision: attributableDecision(review),
      criteria: evidenceCriteria(review),
      earlier: earlier && {
        review: earlier,
        criteria: evidenceCriteria(earlier),
        decision: attributableDecision(earlier),
      },
    };
  });
}

export type TraceDelivery = NonNullable<Effect.Success<ReturnType<typeof readTraceDelivery>>>;
