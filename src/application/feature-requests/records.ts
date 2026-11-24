import { Effect, Stream } from "effect";
import { featureRequestType, isFeatureRequestId } from "../../domain/feature-requests";
import type { DeliveryStage, FeatureRequestId, RequestGate } from "../../domain/feature-requests";
import { deliveryStages } from "../../domain/feature-requests";
import { boardRequestHandoff } from "../backlog";
import type { BoardRequest } from "../backlog";
import { noteChanges, noteSnapshot } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";

type Decoded = ReturnType<typeof featureRequestType.decode<Note["frontmatter"]>>;
type Values = Extract<Decoded, { kind: "editable" }>["values"];
export type FeatureRequest = BoardRequest & {
  readonly id: FeatureRequestId;
  readonly displayId: string;
  readonly revision: number;
  readonly scope: string;
  readonly path: string;
  readonly blocker: Values["blocker"];
  readonly readyGates: readonly RequestGate[] | undefined;
  readonly doneGates: readonly RequestGate[] | undefined;
};

function coreValues(values: Values) {
  const { project_id: projectId, pbi_id: pbiId, display_id: displayId, scope, title } = values;
  if (!projectId || !pbiId || !displayId || !scope || !title) return;
  return { projectId, pbiId, displayId, scope, title };
}

function recordOf(note: Decoded): FeatureRequest | undefined {
  if (note.kind !== "editable" || note.issues.length || !isFeatureRequestId(note.id)) return;
  const core = coreValues(note.values);
  const { revision, state, sequence, run_id } = note.values;
  if (!core || !revision || !state || !sequence) return;
  return {
    id: note.id,
    path: note.path,
    ...core,
    revision,
    state,
    sequence,
    blocker: note.values.blocker,
    readyGates: note.values.ready_gates,
    doneGates: note.values.done_gates,
    ...(run_id && { runId: run_id }),
  };
}

export const decodeFeatureRequest = (note: Note) => recordOf(featureRequestType.decode(note));

function catalog(
  projectId: ProjectId,
  source: {
    readonly notes: readonly Decoded[];
    readonly ready: boolean;
    readonly failure: unknown;
  },
) {
  const records = source.notes
    .flatMap((note) => {
      const record = recordOf(note);
      return record?.projectId === projectId ? [record] : [];
    })
    .toSorted((a, b) => b.sequence - a.sequence || a.id.localeCompare(b.id));
  return { records, ready: source.ready, failed: source.failure !== undefined };
}

export const featureRequestsSnapshot = (project: ProjectId) =>
  Effect.map(noteSnapshot(featureRequestType), (source) => catalog(project, source));
export const featureRequestsChanges = (project: ProjectId) =>
  Stream.map(noteChanges(featureRequestType), (source) => catalog(project, source));

export function featureRequestsForPbi(
  projectId: ProjectId,
  pbiId: string,
  records: readonly FeatureRequest[],
) {
  return boardRequestHandoff(projectId, pbiId, records);
}

const stagesByState = {
  draft: "draft",
  released: "ready",
  queued: "factory",
  running: "factory",
  clarification: "blocked",
  failed: "blocked",
  review: "review",
  "changes-requested": "blocked",
  accepted: "done",
  closed: "done",
} as const satisfies Record<FeatureRequest["state"], DeliveryStage>;

export const requestDeliveryStage = ({
  blocker,
  state,
}: Pick<FeatureRequest, "blocker" | "state">) =>
  blocker && (state === "released" || state === "review") ? "blocked" : stagesByState[state];

export function featureRequestStageCounts(records: readonly FeatureRequest[]) {
  const stages = new Map<DeliveryStage, number>(deliveryStages.map((stage) => [stage, 0]));
  for (const record of records) {
    const stage = requestDeliveryStage(record);
    stages.set(stage, (stages.get(stage) ?? 0) + 1);
  }
  return stages;
}
