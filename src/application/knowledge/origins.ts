import { Context, Effect, Option, Result } from "effect";
import { isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId, KnowledgeValues } from "../../domain/knowledge";
import type { Note, NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import type { VaultReadError } from "../shell";
import { KnowledgeCreateError } from "./errors";
import type { KnowledgeKind } from "./kinds";
import { currentKnowledgeTarget } from "./relations";

type KnowledgeSource = {
  readonly projectId: ProjectId;
  readonly recordId: KnowledgeId;
  readonly kind: "job" | "vision";
};
type DeliverableSource = {
  readonly projectId: ProjectId;
  readonly recordId: string;
  readonly kind: "deliverable";
};

export type KnowledgeOrigin = KnowledgeSource | DeliverableSource;

export class KnowledgeDeliverableOrigins extends Context.Service<
  KnowledgeDeliverableOrigins,
  {
    readonly resolve: (
      origin: DeliverableSource,
      note: { readonly id: KnowledgeId; readonly template: KnowledgeKind },
    ) => Effect.Effect<DeliverableSource | undefined>;
  }
>()("product-engineering/application/KnowledgeDeliverableOrigins") {}

const invalid = () => new KnowledgeCreateError({ reason: "origin" });

function resolveDeliverable(origin: DeliverableSource, id: KnowledgeId, template: KnowledgeKind) {
  return Effect.gen(function* () {
    const source = yield* Effect.serviceOption(KnowledgeDeliverableOrigins);
    const recordId = origin.recordId.trim();
    if (
      Option.isNone(source) ||
      !recordId ||
      recordId !== origin.recordId ||
      Result.isFailure(knowledgeType.fields.deliverable_id.check(recordId))
    )
      return yield* invalid();
    const target = yield* source.value.resolve(origin, { id, template });
    if (target?.projectId !== origin.projectId || target.recordId !== origin.recordId) {
      return yield* invalid();
    }
    return { deliverable_id: target.recordId };
  });
}

function verifyNoteOrigin(
  origin: KnowledgeSource,
  template: KnowledgeKind,
  notes: readonly Note[],
): Effect.Effect<KnowledgeValues, KnowledgeCreateError | VaultReadError, NoteStore> {
  return Effect.gen(function* () {
    const vision = origin.kind === "vision";
    const allowed = vision ? ["prd"] : ["prd", "vision", "research"];
    const { recordId, projectId } = origin;
    if (!isKnowledgeId(recordId) || !allowed.includes(template)) return yield* invalid();
    const target = yield* currentKnowledgeTarget(
      projectId,
      recordId,
      vision ? "vision" : "jtbd",
      notes,
    );
    if (!target) return yield* invalid();
    return vision ? { vision_id: recordId } : { job_ids: [recordId] };
  });
}

export function verifyKnowledgeOrigin(
  projectId: ProjectId,
  id: KnowledgeId,
  template: KnowledgeKind,
  origin: KnowledgeOrigin | undefined,
  notes: readonly Note[],
): Effect.Effect<KnowledgeValues, KnowledgeCreateError | VaultReadError, NoteStore> {
  if (!origin) return Effect.succeed({});
  if (origin.projectId !== projectId) return Effect.fail(invalid());
  return origin.kind === "deliverable"
    ? resolveDeliverable(origin, id, template)
    : verifyNoteOrigin(origin, template, notes);
}
