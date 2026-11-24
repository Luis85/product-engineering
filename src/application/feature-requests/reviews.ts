import { Effect, Stream } from "effect";
import type { ProjectId } from "../projects";
import { matchesRun, requestCiPassed } from "./factory-port";
import type { FactoryAcknowledgement, FactoryJournalEvent } from "./factory-port";
import { featureRequestsChanges, featureRequestsSnapshot } from "./records";
import type { FeatureRequest } from "./records";
import { readFeatureRequestBaseline, requestInputChanges } from "./release";
import { featureRequestRevision } from "./revisions";
import type { FeatureRequestRevision } from "./revisions";

function scopedRun({ run, revision }: FeatureRequestRevision, { projectId, id }: FeatureRequest) {
  if (run?.projectId === projectId && run.requestId === id && run.revision === revision) return run;
}

const noTechnical = {
  technical: undefined,
  testedCommit: undefined,
  technicalApproved: false,
  ciPassed: false,
};

function readTechnical(
  journal: readonly FactoryJournalEvent[],
  frozen: FeatureRequestRevision["package"],
  run: FactoryAcknowledgement,
) {
  if (frozen?.checksum?.value !== run.checksum) return noTechnical;
  const technical = journal.findLast((event) => event.kind === "verified");
  if (technical?.kind !== "verified") return noTechnical;
  const { result } = technical;
  return {
    technical,
    testedCommit: result.commit,
    technicalApproved: result.technicalReview.commit === result.commit,
    ciPassed: requestCiPassed(frozen.package, result),
  };
}

function decisionForRun({ decision }: FeatureRequestRevision, run: FactoryAcknowledgement) {
  if (decision?.runId === run.runId && decision.attempt === run.attempt) return decision;
}

function readDecision(
  decision: FeatureRequestRevision["decision"],
  state: FeatureRequestRevision["state"],
  testedCommit?: string,
) {
  if (!decision) return;
  if (decision.decision === "accepted")
    return decision.commit === testedCommit ? decision : undefined;
  if (!decision.explanation.trim()) return;
  const scopedCommit =
    testedCommit ?? (state === "changes-requested" ? decision.commit : undefined);
  if (decision.commit === scopedCommit) return decision;
}

function hasScopeChange(entry: FeatureRequestRevision, journal: readonly FactoryJournalEvent[]) {
  if (entry.state !== "changes-requested") return false;
  const change = journal.findLast((event) => event.kind === "scope-change");
  return change?.kind === "scope-change" && Boolean(change.reply.trim());
}

function readReviewEvidence(entry: FeatureRequestRevision, run: FactoryAcknowledgement) {
  const events = entry.events.filter(
    (event) => event.runId === run.runId && matchesRun(run, event),
  );
  const result = readTechnical(events, entry.package, run);
  const decision = readDecision(decisionForRun(entry, run), entry.state, result.testedCommit);
  const changes = hasScopeChange(entry, events);
  if (!result.testedCommit && !decision && !changes) return;
  const business =
    decision?.decision ?? (changes ? ("changes-requested" as const) : ("review" as const));
  const { decision: _recorded, ...fields } = entry;
  const evidence: FeatureRequestRevision = {
    ...fields,
    state: business,
    events,
    technical: result.technical,
    ...(decision && { decision }),
  };
  return { result, business, evidence } as const;
}

export function featureRequestReview(record: FeatureRequest, revision: number) {
  const entry = featureRequestRevision(record, revision);
  if (!entry) return;
  const run = scopedRun(entry, record);
  if (!run) return;
  const review = readReviewEvidence(entry, run);
  if (!review) return;
  const { result, business, evidence } = review;
  const { projectId, id: requestId, displayId } = record;
  return {
    row: {
      key: `${projectId}/${requestId}/${revision}`,
      projectId,
      requestId,
      revision,
      displayId,
      title: entry.title,
      runId: run.runId,
      business,
      technicalApproved: result.technicalApproved,
      ciPassed: result.ciPassed,
      testedCommit: result.testedCommit,
    },
    evidence,
  } as const;
}

type ReviewSource = Effect.Success<ReturnType<typeof featureRequestsSnapshot>>;

function readRegister({ records, ready, failed }: ReviewSource) {
  return Effect.gen(function* () {
    const candidates = records.flatMap((record) => {
      const review = featureRequestReview(record, record.revision);
      return review ? [{ record, row: review.row }] : [];
    });
    const rows = yield* Effect.forEach(
      candidates,
      ({ record, row }) =>
        Effect.match(readFeatureRequestBaseline(record), {
          onFailure: () => ({ ...row, stale: undefined }),
          onSuccess: (baseline) => ({ ...row, stale: Boolean(baseline?.stale) }),
        }),
      { concurrency: 4 },
    );
    return { rows, ready, failed };
  });
}

export const reviewRegisterSnapshot = (project: ProjectId) =>
  Effect.flatMap(featureRequestsSnapshot(project), readRegister);

export function reviewRegisterChanges(project: ProjectId) {
  return Stream.merge(
    Stream.as(featureRequestsChanges(project), undefined),
    requestInputChanges(project),
  ).pipe(Stream.mapEffect(() => reviewRegisterSnapshot(project)));
}

export type ReviewRegisterSnapshot = Effect.Success<ReturnType<typeof reviewRegisterSnapshot>>;
export type ReviewRegisterRow = ReviewRegisterSnapshot["rows"][number];
