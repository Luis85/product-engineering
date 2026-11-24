import { Schema } from "effect";
import { defineNoteType, lineOfText, list, recordList, required, text } from "../../notes";
import { projectIdSchema, projectMemberIdSchema } from "../../projects";
import type { ProjectMemberId } from "../../projects";
import { nfrCategories, nfrKey } from "./categories";
import type { NfrCategory } from "./categories";

const title = lineOfText(160).check(Schema.makeFilter((value) => Boolean(value.trim())));
const document = Schema.String.check(Schema.makeFilter((value) => Boolean(value.trim())));
export const nfrIdSchema = Schema.TemplateLiteral(["nfr-", Schema.String]).check(
  Schema.isPattern(/^nfr-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/),
);
const target = Schema.Struct({
  kind: Schema.Literals(["item", "map"]),
  id: lineOfText(160).check(Schema.isMinLength(1)),
});

export type NfrId = typeof nfrIdSchema.Type;
export type NfrTarget = typeof target.Type;
export type NfrDraft = {
  readonly title: string;
  readonly requirement: string;
  readonly acceptance: string;
  readonly owner_id?: ProjectMemberId | undefined;
  readonly categories: readonly NfrCategory[];
};
export type NfrInputIssue = "title" | "requirement" | "acceptance" | "owner" | "category";

export const nfrType = defineNoteType({
  type: "nfr",
  version: 1,
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    title: required(text({ schema: title, issue: "title.invalid" })),
    requirement: required(text({ schema: document, issue: "requirement.invalid" })),
    acceptance: required(text({ schema: document, issue: "acceptance.invalid" })),
    owner_id: text({ schema: projectMemberIdSchema, issue: "owner.invalid" }),
    categories: list({
      schema: Schema.Array(Schema.Literals(nfrCategories.map(([id]) => id))),
      issue: "category.invalid",
    }),
    targets: recordList({ schema: Schema.Array(target), issue: "scope.invalid" }),
  },
  migrations: {},
});

export const nfrTitleKey = nfrKey;

export function checkNfrDraft(draft: NfrDraft): readonly NfrInputIssue[] {
  const fields = nfrType.fields;
  const checks = [
    ["title", fields.title.check(draft.title)],
    ["requirement", fields.requirement.check(draft.requirement)],
    ["acceptance", fields.acceptance.check(draft.acceptance)],
    ["owner", fields.owner_id.check(draft.owner_id)],
    ["category", fields.categories.check(draft.categories)],
  ] as const;
  return checks.flatMap(([code, result]) => (result._tag === "Failure" ? [code] : []));
}
