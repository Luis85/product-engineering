import { Schema } from "effect";
import { itemType as referenceItemType } from "../../../src/domain/items";
import { date, defineNoteType, required, text } from "../../../src/domain/notes";

const title = required(text());
const status = required(
  text({ schema: Schema.Literals(["open", "done"]), issue: "status.unknown" }),
);

export { referenceItemType };

export const referenceEntryType = defineNoteType({
  type: "entry",
  version: 1,
  folder: "Entries",
  fields: { title, status, date: date() },
  migrations: {},
});

export const referenceNoteTypes = [referenceItemType, referenceEntryType] as const;
