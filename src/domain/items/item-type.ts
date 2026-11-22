import { Schema } from "effect";
import { date, defineNoteType, lineOfText, required, text } from "../notes";
import type { FieldIssue, NoteFieldCode, NoteIssue, NoteKey, NoteValues } from "../notes";

export const ITEM_STATUSES = ["open", "done"] as const;
export const TITLE_MAX_LENGTH = 100;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const itemType = defineNoteType({
  type: "item",
  version: 1,
  folder: "Items",
  fields: {
    title: required(text({ schema: lineOfText(TITLE_MAX_LENGTH), issue: "title.invalid" })),
    status: required(text({ schema: Schema.Literals(ITEM_STATUSES), issue: "status.unknown" })),
    due: date(),
  },
  migrations: {},
});

type ItemFields = typeof itemType.fields;
export type ItemKey = NoteKey<ItemFields>;
export type ItemValues = NoteValues<ItemFields>;
type ValidationCode = NoteFieldCode<ItemFields> | "title.too-long" | "title.taken";
export type ItemFieldIssue = FieldIssue<ItemKey, ValidationCode>;
export type DuplicateTitleIssue = FieldIssue<"title", "title.duplicate">;
export type ItemIssue = NoteIssue<ItemKey, ValidationCode | "title.duplicate">;
