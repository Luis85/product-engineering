import { Effect, Option, Schema } from "effect";
import { backlogKinds } from "../../domain/backlog";
import { featureRequestStates } from "../../domain/feature-requests";
import type { FeatureRequestId } from "../../domain/feature-requests";
import type { ProjectId } from "../projects";
import {
  canonicalRequestJson,
  decodeRequestPackage,
  requestGateSchema,
  requestRevisionNumber,
  requestSha,
} from "./delivery-package";
import { factoryAcknowledgement, factoryJournalEvent, readIncompleteReceipt } from "./factory-port";
import { FeatureRequestError } from "./errors";
import type { FeatureRequest } from "./records";
import { changeFeatureRequest, freshFeatureRequest } from "./write";

const str = Schema.String;
const optional = Schema.optionalKey;
const reviewTargetSchema = Schema.Struct({
  runId: str,
  attempt: requestRevisionNumber,
  checksum: str,
  commit: requestSha,
  receiptId: str,
});
const reviewChecks = Schema.Struct({
  ...reviewTargetSchema.fields,
  criteria: Schema.Array(str),
  manual: Schema.Array(str),
});
const reviewWork = Schema.Struct({
  id: str,
  title: optional(str),
  state: optional(str),
  kind: optional(Schema.Literals(backlogKinds)),
  issue: optional(Schema.Literals(["missing", "identity"])),
});
const evidence = Schema.Struct({
  decision: Schema.Literals(["accepted", "changes-requested"]),
  runId: str,
  attempt: requestRevisionNumber,
  commit: requestSha,
  explanation: str,
  proof: optional(
    Schema.Struct({
      ...reviewChecks.fields,
      revision: requestRevisionNumber,
      decidedAt: str,
      reviewers: Schema.Array(str),
      gates: Schema.Array(requestGateSchema),
      work: Schema.Array(reviewWork),
    }),
  ),
});
const current = Schema.Struct({
  exportJson: optional(str),
  run: optional(factoryAcknowledgement),
  events: Schema.Array(factoryJournalEvent),
  releasedAt: optional(str),
  decision: optional(evidence),
  checks: optional(reviewChecks),
});
const historical = Schema.Struct({
  ...current.fields,
  revision: requestRevisionNumber,
  title: str,
  scope: str,
  state: Schema.Literals(featureRequestStates),
  readyGates: optional(Schema.Array(requestGateSchema)),
  doneGates: optional(Schema.Array(requestGateSchema)),
  runId: optional(str),
});
const dataSchema = Schema.fromJsonString(
  Schema.Struct({ current, history: Schema.Array(historical) }),
);
const decode = Schema.decodeUnknownOption(dataSchema);
const looseCurrent = Schema.Struct({
  exportJson: current.fields.exportJson,
  run: optional(Schema.Unknown),
  events: optional(Schema.Array(Schema.Unknown)),
});
const looseHistorical = Schema.Struct({
  ...looseCurrent.fields,
  revision: historical.fields.revision,
  title: historical.fields.title,
  scope: historical.fields.scope,
  state: historical.fields.state,
  runId: historical.fields.runId,
});
const decodeLoose = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      current: looseCurrent,
      history: Schema.Array(looseHistorical),
    }),
  ),
);
const decodeRun = Schema.decodeUnknownOption(factoryAcknowledgement);
type RevisionData = typeof current.Type;
type DeliveryData = typeof dataSchema.Type;

export function readRequestDelivery(record: FeatureRequest): DeliveryData | undefined {
  if (record.deliveryData === undefined) return { current: { events: [] }, history: [] };
  return Option.getOrUndefined(decode(record.deliveryData));
}

export function storeRequestDelivery(data: DeliveryData) {
  return canonicalRequestJson(data);
}

function currentRevision(record: FeatureRequest, details: RevisionData) {
  const { revision, title, scope, state, readyGates, doneGates, runId } = record;
  return {
    ...details,
    revision,
    title,
    scope,
    state,
    ...(readyGates && { readyGates }),
    ...(doneGates && { doneGates }),
    ...(runId && { runId }),
  };
}

function packageFor(record: FeatureRequest, revision: number, raw: string | undefined) {
  if (!raw) return;
  const stored = Option.getOrUndefined(decodeRequestPackage(raw));
  const request = stored?.package.request;
  if (
    request &&
    request.projectId === record.projectId &&
    request.id === record.id &&
    request.revision === revision
  )
    return stored;
}

export function featureRequestRevisions(record: FeatureRequest) {
  const data = readRequestDelivery(record);
  return data?.history.map(({ revision }) => revision).toReversed() ?? [];
}

export function featureRequestRevision(record: FeatureRequest, revision: number) {
  const data = readRequestDelivery(record);
  if (!data) return;
  const isCurrent = record.revision === revision;
  const entry = isCurrent
    ? currentRevision(record, data.current)
    : data.history.find((item) => item.revision === revision);
  if (!entry) return;
  const stored = packageFor(record, revision, entry.exportJson);
  const delivered = entry.events.findLast(({ kind }) => kind === "verified");
  return {
    ...entry,
    isCurrent,
    invalidPackage: entry.exportJson !== undefined && !stored,
    exportJson: stored ? entry.exportJson : undefined,
    package: stored,
    technical: delivered?.kind === "verified" ? delivered : undefined,
  };
}

export type FeatureRequestRevision = NonNullable<ReturnType<typeof featureRequestRevision>>;
export type ReviewRevision = FeatureRequestRevision & {
  readonly incompleteReceipt?: ReturnType<typeof readIncompleteReceipt> | undefined;
  readonly invalidDelivery?: true;
};
export type ReviewWork = typeof reviewWork.Type;
export type ReviewRunTarget = typeof reviewTargetSchema.Type;

function looseRevision(record: FeatureRequest, revision: number) {
  const delivery = Option.getOrUndefined(decodeLoose(record.deliveryData));
  if (record.revision === revision) {
    return {
      fields: currentRevision(record, { events: [] }),
      raw: delivery?.current,
    };
  }
  const raw = delivery?.history.find((entry) => entry.revision === revision);
  if (!raw) return;
  const { title, scope, state, runId } = raw;
  return { fields: { revision, title, scope, state, ...(runId && { runId }), events: [] }, raw };
}

function safeReceipt(
  run: Option.Option<typeof factoryAcknowledgement.Type>,
  record: FeatureRequest,
  revision: number,
  checksum: string | undefined,
) {
  return Option.getOrUndefined(
    Option.filter(
      run,
      (value) =>
        value.projectId === record.projectId &&
        value.requestId === record.id &&
        value.revision === revision &&
        value.checksum === checksum,
    ),
  );
}

function incompleteRevision(record: FeatureRequest, revision: number): ReviewRevision | undefined {
  const selected = looseRevision(record, revision);
  if (!selected) return;
  const { fields, raw } = selected;
  const exportJson = raw?.exportJson;
  const stored = packageFor(record, revision, exportJson);
  return {
    ...fields,
    isCurrent: record.revision === revision,
    invalidPackage: exportJson !== undefined && !stored,
    exportJson: stored ? exportJson : undefined,
    package: stored,
    technical: undefined,
    ...looseReceipt(raw, record, revision, stored),
    invalidDelivery: true,
  };
}

function looseReceipt(
  raw: typeof looseCurrent.Type | undefined,
  record: FeatureRequest,
  revision: number,
  stored: FeatureRequestRevision["package"],
) {
  const decoded = decodeRun(raw?.run);
  const run = Option.getOrUndefined(decoded);
  const matched = safeReceipt(decoded, record, revision, stored?.checksum?.value);
  return {
    ...(run && { run }),
    incompleteReceipt: matched ? readIncompleteReceipt(raw?.events ?? [], matched) : undefined,
  };
}
export function readFeatureRequestRevision(
  projectId: ProjectId,
  id: FeatureRequestId,
  revision: number,
) {
  return Effect.map(freshFeatureRequest({ projectId, id }), (record) => {
    if (!record) return;
    const entry = featureRequestRevision(record, revision) ?? incompleteRevision(record, revision);
    return entry && { ...entry, record };
  });
}

export function canPrepareFollowup(state: FeatureRequest["state"]) {
  return !["draft", "queued", "running", "clarification"].includes(state);
}

function matchesExpectedRevision(record: FeatureRequest, expected: FeatureRequest) {
  return (
    record.revision === expected.revision &&
    record.state === expected.state &&
    record.deliveryData === expected.deliveryData
  );
}

function followupFields(record: FeatureRequest, data: DeliveryData) {
  const archived = currentRevision(record, data.current);
  const requested = data.current.events.findLast(({ kind }) => kind === "scope-change");
  const scope = requested?.kind === "scope-change" ? requested.reply : record.scope;
  return {
    revision: record.revision + 1,
    state: "draft",
    scope,
    blocker: undefined,
    run_id: undefined,
    ready_gates: undefined,
    done_gates: undefined,
    ready_checks: undefined,
    ready_check_version: undefined,
    ...(record.runId && { dispatch_recorded: true }),
    delivery_data: storeRequestDelivery({
      current: { events: [] },
      history: [...data.history, archived],
    }),
  };
}

export function prepareRequestFollowup(expected: FeatureRequest) {
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (!matchesExpectedRevision(record, expected))
        return yield* new FeatureRequestError({ reason: "conflict" });
      const data = readRequestDelivery(record);
      if (!data || !canPrepareFollowup(record.state) || record.revision === Number.MAX_SAFE_INTEGER)
        return yield* new FeatureRequestError({ reason: "delivery" });
      yield* persist(followupFields(record, data));
    }),
  );
}
