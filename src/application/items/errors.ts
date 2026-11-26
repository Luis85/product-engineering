import { Schema } from "effect";
import { itemType } from "../../domain/items";
import type { ItemFieldIssue } from "../../domain/items";
import type { ErrorTags } from "../module";

const issueCodes = {
  "field.missing": true,
  "field.text": true,
  "field.date": true,
  "title.invalid": true,
  "title.too-long": true,
  "title.taken": true,
  "status.unknown": true,
} satisfies Record<ItemFieldIssue["code"], true>;

const issues = Schema.Array(
  Schema.Struct({
    key: Schema.Literals(itemType.keys),
    code: Schema.Literals(Object.keys(issueCodes) as (keyof typeof issueCodes)[]),
  }),
);

export class InvalidItemError extends Schema.TaggedError<InvalidItemError>()("InvalidItemError", {
  issues,
}) {}

export const ITEM_ERROR_TAG_KEYS = { InvalidItemError: true } satisfies ErrorTags<InvalidItemError>;
