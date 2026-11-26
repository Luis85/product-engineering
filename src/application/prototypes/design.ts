import { Effect } from "effect";
import { isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { prototypeDesignFields, prototypeDesignKinds } from "../../domain/prototypes";
import type { PrototypeDesignKind } from "../../domain/prototypes";
import { createKnowledge, resolveKnowledgeNote, validKnowledgeTitle } from "../knowledge";
import type { KnowledgeDraft } from "../knowledge";
import type { Note, NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import { PrototypeError } from "./errors";

export type PrototypeDesign = {
  readonly id: KnowledgeId;
  readonly draft?: KnowledgeDraft;
};
export type PrototypeDesigns = Readonly<Partial<Record<PrototypeDesignKind, PrototypeDesign>>>;

function freshExisting(store: NoteStore["Service"], notes: readonly Note[], id: KnowledgeId) {
  return Effect.gen(function* () {
    const matches = notes.filter(({ frontmatter }) => frontmatter.id === id);
    if (matches.length > 1) return yield* new PrototypeError({ reason: "design" });
    const match = matches[0];
    if (!match) return;
    return yield* store
      .readFresh(match.path)
      .pipe(
        Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () =>
          Effect.succeed(undefined),
        ),
      );
  });
}

function matchesDesign(
  note: Note,
  projectId: ProjectId,
  kind: PrototypeDesignKind,
  id: KnowledgeId,
) {
  const record = knowledgeType.decode(note);
  return (
    record.kind === "editable" &&
    !record.issues.length &&
    record.id === id &&
    record.values.project_id === projectId &&
    record.values.kind === kind
  );
}

function validDraft(kind: PrototypeDesignKind, draft: KnowledgeDraft) {
  return (
    draft.kind === kind &&
    validKnowledgeTitle(kind, draft.title) &&
    Boolean(draft.body?.trim()) &&
    ![draft.owner_id, draft.actor_type, draft.vision_id, draft.job_ids.length].some(Boolean)
  );
}

function validateDesign(
  store: NoteStore["Service"],
  notes: readonly Note[],
  projectId: ProjectId,
  kind: PrototypeDesignKind,
  design: PrototypeDesign,
) {
  return Effect.gen(function* () {
    const { draft, id } = design;
    if (!isKnowledgeId(id)) return yield* new PrototypeError({ reason: "design" });
    if (draft) {
      if (!validDraft(kind, draft)) return yield* new PrototypeError({ reason: "designDraft" });
      const existing = yield* freshExisting(store, notes, id);
      if (existing && !matchesDesign(existing, projectId, kind, id))
        return yield* new PrototypeError({ reason: "design" });
      return;
    }
    const record = yield* resolveKnowledgeNote(projectId, id).pipe(
      Effect.catchTag("NoteUnreadableError", () => Effect.succeed(undefined)),
    );
    if (record?.kind !== kind) return yield* new PrototypeError({ reason: "design" });
  });
}

export function validatePrototypeDesigns(
  store: NoteStore["Service"],
  notes: readonly Note[],
  projectId: ProjectId,
  designs: PrototypeDesigns,
) {
  return Effect.gen(function* () {
    const styleId = designs["style-guide"]?.id;
    if (styleId && styleId === designs["design-system"]?.id)
      return yield* new PrototypeError({ reason: "design" });
    for (const kind of prototypeDesignKinds) {
      const design = designs[kind];
      if (design) yield* validateDesign(store, notes, projectId, kind, design);
    }
  });
}

export function savePrototypeDesigns(projectId: ProjectId, designs: PrototypeDesigns) {
  return Effect.gen(function* () {
    for (const kind of prototypeDesignKinds) {
      const selection = designs[kind];
      if (!selection?.draft) continue;
      const { id, draft } = selection;
      const note = yield* createKnowledge({ id, projectId }, draft);
      if (!matchesDesign(note, projectId, kind, id))
        return yield* new PrototypeError({ reason: "design" });
    }
  });
}

export function prototypeDesignValues(designs: PrototypeDesigns) {
  return Object.fromEntries(
    prototypeDesignKinds.map((kind) => [prototypeDesignFields[kind], designs[kind]?.id]),
  );
}
