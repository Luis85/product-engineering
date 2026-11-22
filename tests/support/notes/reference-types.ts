import { Schema } from "effect";
import { date, defineNoteType, required, text } from "../../../src/domain/notes";

const title = required(text());
const status = required(
  text({ schema: Schema.Literals(["open", "done"]), issue: "status.unknown" }),
);

export const referenceItemType = defineNoteType({
  type: "item",
  version: 1,
  folder: "Items",
  fields: { title, status, due: date() },
  migrations: {},
});

export const referenceEntryType = defineNoteType({
  type: "entry",
  version: 1,
  folder: "Entries",
  fields: { title, status, date: date() },
  migrations: {},
});

export const referenceNoteTypes = [referenceItemType, referenceEntryType] as const;
