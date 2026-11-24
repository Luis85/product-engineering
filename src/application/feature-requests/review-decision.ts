import { Clock, Effect, Result } from "effect";
import { reviewChangeExplanation } from "../../domain/feature-requests";
import type { FeatureRequestId, RequestGate } from "../../domain/feature-requests";
import { projectMembers, readFreshProject } from "../projects";
import type { ProjectId } from "../projects";
import { verifyRequestPackage } from "./delivery-package";
import type { RequestPackage } from "./delivery-package";
import { FeatureRequestError } from "./errors";
import { requestCiPassed } from "./factory-port";
import type { FeatureRequest } from "./records";
import { readFeatureRequestBaseline } from "./release";
import { configuredReviewGate, readReviewWork, reviewGateWork } from "./review-work";
import { featureRequestReview, scopedReviewRun } from "./reviews";
import {
  featureRequestRevision,
  readFeatureRequestRevision,
  readRequestDelivery,
  storeRequestDelivery,
} from "./revisions";
import type {
  FeatureRequestRevision,
  ReviewRevision,
  ReviewRunTarget,
  ReviewWork,
} from "./revisions";
import { changeFeatureRequest } from "./write";

export type ReviewTarget = ReviewRunTarget & {
  readonly projectId: ProjectId;
  readonly id: FeatureRequestId;
  readonly revision: number;
};

type ReviewBlocker =
  | "previous"
  | "state"
  | "package"
  | "run"
  | "receipt"
  | "commit"
  | "technical"
  | "ci"
  | "baseline"
  | "stale";

function sameRunTarget(left: ReviewRunTarget | undefined, right: ReviewRunTarget) {
  return (
    left?.runId === right.runId &&
    left.attempt === right.attempt &&
    left.checksum === right.checksum &&
    left.commit === right.commit &&
    left.receiptId === right.receiptId
  );
}

function currentChecks(entry: FeatureRequestRevision, target: ReviewTarget | undefined) {
  if (entry.decision?.proof) return entry.decision.proof;
  if (target && sameRunTarget(entry.checks, target)) return entry.checks;
}

function reviewTarget(
  record: FeatureRequest,
  entry: FeatureRequestRevision,
  run: ReturnType<typeof scopedReviewRun>,
  receipt: FeatureRequestRevision["technical"],
): ReviewTarget | undefined {
  if (!run || !receipt) return;
  return {
    projectId: record.projectId,
    id: record.id,
    revision: entry.revision,
    runId: run.runId,
    attempt: run.attempt,
    checksum: run.checksum,
    commit: receipt.result.commit,
    receiptId: receipt.id,
  };
}

function receiptBlocker(
  entry: ReviewRevision,
  review: ReturnType<typeof featureRequestReview>,
): ReviewBlocker | undefined {
  if (entry.invalidDelivery) return entry.incompleteReceipt?.issue ?? "receipt";
  if (!review?.evidence.technical) return entry.technical ? "receipt" : "commit";
  if (!review.row.technicalApproved) return "technical";
  if (!readyPullRequest(review)) return "ci";
}

function readyPullRequest(review: NonNullable<ReturnType<typeof featureRequestReview>>) {
  return review.row.ciPassed && Boolean(review.evidence.technical?.result.pullRequest.trim());
}

function activeBlocker(
  entry: ReviewRevision,
  status: Effect.Success<ReturnType<typeof readReviewStatus>>,
): ReviewBlocker | undefined {
  if (!entry.isCurrent) return "previous";
  if (entry.state !== "review" || entry.decision) return "state";
  if (status.issue) return status.issue;
  if (!status.baseline) return "baseline";
  if (status.baseline.stale) return "stale";
}

function inspectReceipt(record: FeatureRequest, entry: ReviewRevision, verified: boolean) {
  const run = scopedReviewRun(entry, record);
  const review = featureRequestReview(record, entry.revision);
  const receipt = verified ? review?.evidence.technical : undefined;
  const partial = verified ? entry.incompleteReceipt : undefined;
  const issue = evidenceIssue(entry, verified, run, review);
  return { run, review, receipt, partial, issue };
}

function evidenceIssue(
  entry: ReviewRevision,
  verified: boolean,
  run: ReturnType<typeof scopedReviewRun>,
  review: ReturnType<typeof featureRequestReview>,
): ReviewBlocker | undefined {
  if (!verified) return "package";
  if (!run || run.runId !== entry.runId || run.checksum !== entry.package?.checksum?.value)
    return "run";
  return receiptBlocker(entry, review);
}

function reviewEvidenceFields(
  entry: ReviewRevision,
  { receipt, partial, review }: ReturnType<typeof inspectReceipt>,
) {
  const result = receipt?.result ?? partial;
  const testedCommit = result?.commit;
  const ciChecks = result?.evidence ?? [];
  const payload = entry.package?.package;
  const ciPassed = evidencePassesCi(payload, testedCommit, ciChecks);
  return {
    testedCommit,
    ciChecks,
    ciPassed,
    pullRequest: result?.pullRequest,
    technicalApproved: Boolean(receipt && review?.row.technicalApproved),
  };
}

function evidencePassesCi(
  payload: RequestPackage | undefined,
  commit: string | undefined,
  evidence: Parameters<typeof requestCiPassed>[1]["evidence"],
) {
  return Boolean(payload && commit && requestCiPassed(payload, { commit, evidence }));
}

function readReviewStatus(record: FeatureRequest, entry: ReviewRevision) {
  return Effect.gen(function* () {
    const frozen = entry.package;
    const verified = frozen
      ? Result.isSuccess(yield* Effect.result(verifyRequestPackage(frozen)))
      : false;
    const baselineResult = yield* Effect.result(readFeatureRequestBaseline(record, entry.revision));
    const baseline = Result.isSuccess(baselineResult) ? baselineResult.success : undefined;
    return { ...inspectReceipt(record, entry, verified), baseline };
  });
}

const readReviewers = (projectId: ProjectId) =>
  Effect.map(readFreshProject(projectId), (project) => {
    const members = project && projectMembers(project);
    return members?.filter(({ role }) => role === "product-owner").map(({ name }) => name) ?? [];
  });

function confirmedCriteria(
  entry: FeatureRequestRevision,
  checks: ReturnType<typeof currentChecks>,
) {
  const criteria = (entry.package?.package.useCase?.criteria ?? []).map((criterion) => ({
    ...criterion,
    confirmed: checks?.criteria.includes(criterion.id) ?? false,
  }));
  return { criteria, confirmed: criteria.filter((criterion) => criterion.confirmed).length };
}

function reviewChecklist(
  entry: FeatureRequestRevision,
  { confirmed, criteria }: ReturnType<typeof confirmedCriteria>,
  work: readonly ReviewWork[] | undefined,
  manual: readonly string[] | undefined,
  blocker: ReviewBlocker | undefined,
) {
  const payload = entry.package?.package;
  const rules = reviewRules(payload);
  const live = [
    { id: "base-done", status: blocker ? "open" : "passed" },
    {
      id: "base-review",
      status: criteria.length && confirmed === criteria.length ? "passed" : "open",
    },
    ...rules.map((rule) => configuredReviewGate(rule, payload, manual, work)),
  ] satisfies readonly RequestGate[];
  return {
    gates: recordedReviewGates(entry) ?? live,
    workByGate: Object.fromEntries(rules.map(({ id, type }) => [id, reviewGateWork(type, work)])),
    manualIds: rules.filter(({ type }) => type === "manual").map(({ id }) => id),
  };
}

function reviewRules(payload: RequestPackage | undefined) {
  return payload?.definitions?.done.filter(({ enabled }) => enabled) ?? [];
}

function recordedReviewGates(entry: FeatureRequestRevision) {
  if (entry.isCurrent && !entry.decision) return;
  return entry.decision?.proof?.gates ?? entry.doneGates;
}

function reviewScope(record: FeatureRequest, entry: FeatureRequestRevision) {
  const frozenIds = entry.package?.package.workIds;
  if (entry.isCurrent && !entry.decision)
    return readReviewWork(record.projectId, record.pbiId, frozenIds);
  return Effect.succeed(
    entry.decision?.proof?.work ?? frozenIds?.map((id): ReviewWork => ({ id })),
  );
}

function inspectReview(record: FeatureRequest, entry: ReviewRevision) {
  return Effect.gen(function* () {
    const status = yield* readReviewStatus(record, entry);
    const { run, review, receipt, baseline } = status;
    const target = reviewTarget(record, entry, run, receipt);
    const blocker = activeBlocker(entry, status);
    const { decision: _unconfirmed, ...fields } = entry;
    const evidence = { ...fields, ...review?.evidence, technical: receipt };
    const work = yield* reviewScope(record, evidence);
    const reviewers =
      evidence.decision?.proof?.reviewers ?? (yield* readReviewers(record.projectId));
    const checks = currentChecks(evidence, target);
    const progress = confirmedCriteria(evidence, checks);
    return {
      record,
      entry: evidence,
      target,
      receipt,
      run,
      ...reviewEvidenceFields(entry, status),
      reviewers,
      baseline,
      blocker,
      ...progress,
      checks,
      work,
      ...reviewChecklist(evidence, progress, work, checks?.manual, blocker),
    };
  });
}
export type ReviewWorkspace = Effect.Success<ReturnType<typeof inspectReview>>;

export function readReviewWorkspace(projectId: ProjectId, id: FeatureRequestId, revision: number) {
  return Effect.flatMap(readFeatureRequestRevision(projectId, id, revision), (entry) => {
    if (!entry) return Effect.succeed(undefined);
    return inspectReview(entry.record, entry);
  });
}

export function confirmReviewCheck(
  expected: ReviewTarget,
  kind: "criteria" | "manual",
  id: string,
  confirmed: boolean,
) {
  return changeFeatureRequest(expected, (current, persist) =>
    Effect.gen(function* () {
      const { fresh, data, target } = yield* activeReview(current, expected);
      const allowed =
        kind === "criteria"
          ? fresh.criteria.some((criterion) => criterion.id === id)
          : fresh.manualIds.some((manual) => manual === id);
      if (!allowed) return yield* new FeatureRequestError({ reason: "evidence" });
      const checks = {
        ...target,
        criteria: fresh.checks?.criteria ?? [],
        manual: fresh.checks?.manual ?? [],
      };
      if (checks[kind].includes(id) === confirmed) return;
      checks[kind] = confirmed
        ? [...checks[kind], id].toSorted()
        : checks[kind].filter((key) => key !== id);
      yield* persist({
        delivery_data: storeRequestDelivery({ ...data, current: { ...data.current, checks } }),
      });
    }),
  );
}

function activeReview(current: FeatureRequest, expected: ReviewTarget) {
  return Effect.gen(function* () {
    const entry = featureRequestRevision(current, expected.revision);
    const data = readRequestDelivery(current);
    if (!entry?.isCurrent || current.state !== "review" || !data || data.current.decision)
      return yield* new FeatureRequestError({ reason: "conflict" });
    const fresh = yield* inspectReview(current, entry);
    if (!sameRunTarget(fresh.target, expected))
      return yield* new FeatureRequestError({ reason: "conflict" });
    if (fresh.blocker)
      return yield* new FeatureRequestError({
        reason: fresh.blocker === "stale" ? "stale" : "evidence",
      });
    const { projectId: _project, id: _id, revision: _revision, ...target } = expected;
    return { fresh, data, target };
  });
}

function recordReviewDecision(
  expected: ReviewTarget,
  verdict: "accepted" | "changes-requested",
  explanation: string,
) {
  return changeFeatureRequest(expected, (current, persist) =>
    Effect.gen(function* () {
      const { fresh, data, target } = yield* activeReview(current, expected);
      if (
        verdict === "accepted" &&
        (!fresh.entry.package?.package.definitions ||
          fresh.gates.some(({ status }) => status !== "passed"))
      )
        return yield* new FeatureRequestError({ reason: "review-done" });
      const decision = {
        decision: verdict,
        runId: target.runId,
        attempt: target.attempt,
        commit: target.commit,
        explanation,
        proof: {
          ...target,
          revision: expected.revision,
          decidedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
          reviewers: fresh.reviewers,
          criteria: fresh.checks?.criteria ?? [],
          manual: fresh.checks?.manual ?? [],
          gates: fresh.gates,
          work: fresh.work ?? [],
        },
      };
      yield* persist({
        state: decision.decision,
        done_gates: fresh.gates,
        delivery_data: storeRequestDelivery({ ...data, current: { ...data.current, decision } }),
      });
    }),
  );
}

export const acceptReview = (expected: ReviewTarget) =>
  recordReviewDecision(expected, "accepted", "");

export function requestReviewChange(expected: ReviewTarget, reason: string) {
  const explanation = reviewChangeExplanation(reason);
  if (!explanation) return Effect.fail(new FeatureRequestError({ reason: "review-reason" }));
  return recordReviewDecision(expected, "changes-requested", explanation);
}
