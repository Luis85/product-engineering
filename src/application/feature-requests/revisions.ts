import { Effect, Option, Schema } from "effect";
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
import { factoryAcknowledgement, factoryJournalEvent } from "./factory-port";
import { FeatureRequestError } from "./errors";
import type { FeatureRequest } from "./records";
import { changeFeatureRequest, freshFeatureRequest } from "./write";

const str = Schema.String;
const optional = Schema.optionalKey;
const evidence = Schema.Struct({
  decision: Schema.Literals(["accepted", "changes-requested"]),
  runId: str,
  attempt: requestRevisionNumber,
  commit: requestSha,
  explanation: str,
});
const current = Schema.Struct({
  exportJson: optional(str),
  run: optional(factoryAcknowledgement),
  events: Schema.Array(factoryJournalEvent),
  releasedAt: optional(str),
  decision: optional(evidence),
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

export function readFeatureRequestRevision(
  projectId: ProjectId,
  id: FeatureRequestId,
  revision: number,
) {
  return Effect.map(
    freshFeatureRequest({ projectId, id }),
    (record) => record && featureRequestRevision(record, revision),
  );
}

export function canPrepareFollowup(state: FeatureRequest["state"]) {
  return !["draft", "queued", "running", "clarification"].includes(state);
}

export function prepareRequestFollowup(expected: FeatureRequest) {
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (record.revision !== expected.revision)
        return yield* new FeatureRequestError({ reason: "conflict" });
      const data = readRequestDelivery(record);
      if (!data || !canPrepareFollowup(record.state) || record.revision === Number.MAX_SAFE_INTEGER)
        return yield* new FeatureRequestError({ reason: "delivery" });
      const archived = currentRevision(record, data.current);
      const requested = data.current.events.findLast(({ kind }) => kind === "scope-change");
      const scope = requested?.kind === "scope-change" ? requested.reply : record.scope;
      yield* persist({
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
      });
    }),
  );
}
