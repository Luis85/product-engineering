import { Effect, Schema } from "effect";
import type { RequestGate } from "../../domain/feature-requests";
import { invalidRequestField, normalizeRequestScope } from "../../domain/feature-requests";
import { backlogSnapshot, pbiWorkIsOpen } from "../backlog";
import type { BacklogItem } from "../backlog";
import type { ProjectCriterion, ProjectId } from "../projects";
import { canonicalRequestJson, verifyRequestPackage } from "./delivery-package";
import type { RequestPackage } from "./delivery-package";
import { FeatureRequestError } from "./errors";
import {
  factoryEventSchema,
  FeatureRequestDelivery,
  matchesRun,
  requestCiPassed,
} from "./factory-port";
import type {
  FactoryAcknowledgement,
  FactoryCallback,
  FactoryFixtureAction,
  FactoryJournalEvent,
} from "./factory-port";
import { readFeatureRequestBaseline } from "./release";
import type { FeatureRequest } from "./records";
import { featureRequestRevision, readRequestDelivery, storeRequestDelivery } from "./revisions";
import { changeFeatureRequest, freshFeatureRequest } from "./write";

const failure = (reason: FeatureRequestError["reason"]) => new FeatureRequestError({ reason });

function originalAcknowledgement(events: readonly FactoryJournalEvent[]) {
  const first = events.find(({ kind }) => kind === "dispatched");
  if (first) {
    const { id: _id, kind: _kind, ...ack } = first;
    return ack;
  }
}

function releasedPackage(record: FeatureRequest) {
  return Effect.gen(function* () {
    const data = readRequestDelivery(record);
    const revision = featureRequestRevision(record, record.revision);
    if (!data || !revision?.package) return yield* failure("evidence");
    const checksum = yield* verifyRequestPackage(revision.package);
    return { data, package: revision.package.package, checksum };
  });
}

export function dispatchFeatureRequest(expected: FeatureRequest) {
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (record.revision !== expected.revision) return yield* failure("conflict");
      const stored = yield* releasedPackage(record);
      const { data, package: payload, checksum } = stored;
      if (data.current.run) {
        const original = originalAcknowledgement(data.current.events);
        if (!original) return yield* failure("evidence");
        return original;
      }
      if (record.state !== "released") return yield* failure("delivery");
      const baseline = yield* readFeatureRequestBaseline(record);
      if (!baseline || baseline.stale) return yield* failure("stale");
      const key = {
        projectId: record.projectId,
        requestId: record.id,
        revision: record.revision,
        checksum,
        attempt: 1,
      };
      const run = yield* FeatureRequestDelivery.use((port) => port.dispatch(key, payload));
      if (!matchesRun(key, run) || !run.runId) return yield* failure("evidence");
      const event = { ...run, id: "dispatch:" + run.runId, kind: "dispatched" } as const;
      yield* persist({
        state: "queued",
        run_id: run.runId,
        blocker: undefined,
        dispatch_recorded: true,
        delivery_data: storeRequestDelivery({
          ...data,
          current: { ...data.current, run, events: [...data.current.events, event] },
        }),
      });
      return run;
    }),
  );
}

export function retryFeatureRequest(expected: FeatureRequest) {
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (record.revision !== expected.revision) return yield* failure("conflict");
      const { data } = yield* releasedPackage(record);
      const previous = data.current.run;
      const selected = readRequestDelivery(expected)?.current.run;
      if (!previous || !selected || selected.runId !== previous.runId)
        return yield* failure("delivery");
      if (previous.attempt === selected.attempt + 1) return previous;
      const run = yield* startRetry(record, previous, selected.attempt);
      const event = { ...run, id: "retry:" + run.attempt, kind: "retried" } as const;
      yield* persist({
        state: "queued",
        delivery_data: storeRequestDelivery({
          ...data,
          current: { ...data.current, run, events: [...data.current.events, event] },
        }),
      });
      return run;
    }),
  );
}

function startRetry(record: FeatureRequest, previous: FactoryAcknowledgement, lastAttempt: number) {
  return Effect.gen(function* () {
    if (
      record.state !== "failed" ||
      previous.attempt !== lastAttempt ||
      previous.attempt === Number.MAX_SAFE_INTEGER
    )
      return yield* failure("delivery");
    const baseline = yield* readFeatureRequestBaseline(record);
    if (!baseline || baseline.stale) return yield* failure("stale");
    const run = yield* FeatureRequestDelivery.use((port) => port.retry(previous));
    if (
      run.runId !== previous.runId ||
      !matchesRun({ ...previous, attempt: previous.attempt + 1 }, run)
    )
      return yield* failure("evidence");
    return run;
  });
}

const states = {
  "picked-up": "running",
  question: "clarification",
  failed: "failed",
  verified: "review",
} as const;

function verifyTechnicalResult(
  payload: RequestPackage,
  result: Extract<FactoryCallback, { kind: "verified" }>["result"],
) {
  return (
    Boolean(result.pullRequest.trim()) &&
    result.technicalReview.commit === result.commit &&
    requestCiPassed(payload, result)
  );
}

const workKind = { "open-task": "TASK", "open-issue": "ISS", "open-bug": "BUG" } as const;

function evaluateDoneGate(
  { id, title, type }: ProjectCriterion,
  scopedWork: readonly BacklogItem[] | undefined,
): RequestGate {
  if (type === "scope") return { id, title, status: "passed" };
  if (type === "manual") return { id, title, status: "open" };
  if (!scopedWork) return { id, title, status: "unavailable" };
  const rows =
    type === "open-work" ? scopedWork : scopedWork.filter(({ kind }) => kind === workKind[type]);
  return { id, title, status: rows.some(pbiWorkIsOpen) ? "open" : "passed" };
}

function doneEvidence(projectId: ProjectId, payload: RequestPackage) {
  return Effect.gen(function* () {
    const work = new Set(payload.workIds);
    const backlog = yield* backlogSnapshot(projectId);
    const current = backlog.items.filter((item) => item.id && work.has(item.id) && !item.conflict);
    const scoped = current.length === work.size && payload.workIds ? current : undefined;
    return [
      { id: "base-done", status: "passed" },
      { id: "base-review", status: "open" },
      ...(payload.definitions?.done.map((criterion) => evaluateDoneGate(criterion, scoped)) ?? []),
    ] satisfies readonly RequestGate[];
  });
}

function eventDisposition(
  state: FeatureRequest["state"],
  run: FactoryAcknowledgement | undefined,
  history: readonly FactoryJournalEvent[],
  event: FactoryCallback,
) {
  return Effect.gen(function* () {
    if (!run || run.runId !== event.runId || !matchesRun(run, event)) return "ignored" as const;
    const delivered = history.find(({ id }) => id === event.id);
    if (delivered) {
      if (canonicalRequestJson(delivered) !== canonicalRequestJson(event))
        return yield* failure("evidence");
      return "duplicate" as const;
    }
    return state === (event.kind === "picked-up" ? "queued" : "running")
      ? ("recorded" as const)
      : ("ignored" as const);
  });
}

function eventMatchesPayload(payload: RequestPackage, event: FactoryCallback) {
  if (event.kind === "question")
    return event.scope === payload.scope && Boolean(event.question.trim());
  if (event.kind === "verified") return verifyTechnicalResult(payload, event.result);
  return true;
}

export function recordFactoryEvent(event: FactoryCallback) {
  if (!Schema.is(factoryEventSchema)(event)) return Effect.fail(failure("evidence"));
  return changeFeatureRequest(
    { projectId: event.projectId, id: event.requestId },
    (record, persist) =>
      Effect.gen(function* () {
        if (record.revision !== event.revision) return "ignored" as const;
        const { data, package: payload } = yield* releasedPackage(record);
        const { run, events } = data.current;
        const disposition = yield* eventDisposition(record.state, run, events, event);
        if (disposition !== "recorded") return disposition;
        if (!eventMatchesPayload(payload, event)) return yield* failure("evidence");
        const gates =
          event.kind === "verified" ? yield* doneEvidence(record.projectId, payload) : undefined;
        yield* persist({
          state: states[event.kind],
          ...(gates && { done_gates: gates }),
          delivery_data: storeRequestDelivery({
            ...data,
            current: { ...data.current, events: [...events, event] },
          }),
        });
        return "recorded" as const;
      }),
  );
}

export function simulateFactoryEvent(expected: FeatureRequest, action: FactoryFixtureAction) {
  return Effect.gen(function* () {
    const record = yield* freshFeatureRequest(expected);
    if (!record || record.revision !== expected.revision) return yield* failure("conflict");
    const { data, package: payload } = yield* releasedPackage(record);
    const run = data.current.run;
    if (!run) return yield* failure("delivery");
    const event = yield* FeatureRequestDelivery.use((port) =>
      port.fixtureEvent(run, payload, action, data.current.events.length),
    );
    return yield* recordFactoryEvent(event);
  });
}

export function replayFactoryEvent(expected: FeatureRequest, version: number) {
  return Effect.gen(function* () {
    const record = yield* freshFeatureRequest(expected);
    const revision = record && featureRequestRevision(record, version);
    const event = revision?.events.findLast(Schema.is(factoryEventSchema));
    if (!event) return yield* failure("evidence");
    return yield* recordFactoryEvent(event);
  });
}

function currentQuestion(
  state: FeatureRequest["state"],
  events: readonly FactoryJournalEvent[],
  questionId: string,
) {
  const question = events.at(-1);
  if (state === "clarification" && question?.kind === "question" && question.id === questionId)
    return question;
}

export function replyToFactory(
  expected: FeatureRequest,
  questionId: string,
  response: string,
  changesScope: boolean,
) {
  const reply = normalizeRequestScope(response);
  if (invalidRequestField("scope", reply)) return Effect.fail(failure("scope"));
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (record.revision !== expected.revision) return yield* failure("conflict");
      const { data } = yield* releasedPackage(record);
      const { run, events } = data.current;
      const question = currentQuestion(record.state, events, questionId);
      if (!run || !question) return yield* failure("delivery");
      if (changesScope && reply === question.scope) return yield* failure("scope");
      const event: FactoryJournalEvent = {
        ...run,
        id: "reply:" + questionId,
        questionId,
        reply,
        kind: changesScope ? "scope-change" : "reply",
      };
      yield* persist({
        state: changesScope ? "changes-requested" : "running",
        delivery_data: storeRequestDelivery({
          ...data,
          current: { ...data.current, events: [...events, event] },
        }),
      });
    }),
  );
}
