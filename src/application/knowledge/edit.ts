import { Effect, Result } from "effect";
import { checkedEntityAttributes, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeValues } from "../../domain/knowledge";
import {
  NoteEditConflictError,
  NoteNotFoundError,
  NoteStore,
  NoteWriteRefusedError,
  editChange,
} from "../notes";
import type { NoteContentChange } from "../notes";
import { resolveProjectMember } from "../projects";
import { KnowledgeEditError } from "./errors";
import { knowledgeNoteOf } from "./selection";
import type { KnowledgeNote } from "./selection";

type EditableField = "title" | "approval" | "owner_id" | "references" | "domain_attributes";
export type KnowledgeEditFields = {
  readonly [Key in EditableField]?: KnowledgeValues[Key] | undefined;
};

function validateAttributes(
  base: KnowledgeNote,
  input: NonNullable<KnowledgeEditFields["domain_attributes"]>,
) {
  const attributes = checkedEntityAttributes(input);
  return base.kind === "entity" && Result.isSuccess(attributes)
    ? Effect.succeed(attributes.success ?? [])
    : Effect.fail(new KnowledgeEditError({ reason: "domain_attributes" }));
}

function validateFields(base: KnowledgeNote, fields: KnowledgeEditFields) {
  return Effect.gen(function* () {
    const edited = {
      ...fields,
      ...(fields.title !== undefined ? { title: fields.title.trim() } : {}),
    };
    if (edited.title === "") return yield* new KnowledgeEditError({ reason: "title" });
    if (edited.domain_attributes !== undefined) {
      edited.domain_attributes = yield* validateAttributes(base, edited.domain_attributes);
    }
    for (const field of Object.keys(edited) as (keyof KnowledgeEditFields)[]) {
      if (Result.isFailure<unknown, string>(knowledgeType.fields[field].check(edited[field]))) {
        return yield* new KnowledgeEditError({ reason: field });
      }
    }
    if (edited.owner_id && !(yield* resolveProjectMember(base.projectId, edited.owner_id))) {
      return yield* new KnowledgeEditError({ reason: "owner_id" });
    }
    return edited;
  });
}

export function saveKnowledgeNote(base: KnowledgeNote, body: string, fields: KnowledgeEditFields) {
  const changedBody = body !== base.body.replace(/\r\n|\r/g, "\n");
  return Effect.gen(function* () {
    const edited = yield* validateFields(base, fields);
    const merge = editChange(knowledgeType, base.frontmatter, { ...base.frontmatter, ...edited });
    const change: NoteContentChange<NoteEditConflictError | NoteWriteRefusedError> = (current) => {
      const { project_id, title, kind, domain_archived } = knowledgeType.check(
        current.frontmatter,
      ).values;
      if (
        project_id !== base.projectId ||
        !title ||
        kind !== base.kind ||
        (edited.domain_attributes !== undefined && domain_archived)
      ) {
        return Result.fail(new NoteWriteRefusedError({ reason: "identity" }));
      }
      if (
        changedBody &&
        current.body !== base.body &&
        current.body.replace(/\r\n|\r/g, "\n") !== body
      ) {
        return Result.fail(new NoteEditConflictError({ conflicts: [] }));
      }
      return Result.map(merge(current.frontmatter), (patch) => ({
        patch,
        ...(changedBody ? { body } : {}),
      }));
    };
    const store = yield* NoteStore;
    const written = yield* store.updateContent(base.path, change);
    const note = knowledgeNoteOf(written);
    if (!note) return yield* new NoteNotFoundError();
    return note;
  });
}
