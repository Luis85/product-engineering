import { Schema } from "effect";
import { defineNoteType, lineOfText, required, text } from "../notes";
export { completePbiCriterion, pbiCriteria, pbiCriterionDraft, pbiFeature } from "./criteria";
export type { PbiCriterion, PbiCriterionDraft } from "./criteria";

export const backlogKinds = ["EP", "FE", "UC", "TASK", "ISS", "Q", "BUG"] as const;
export type BacklogKind = (typeof backlogKinds)[number];
export const hostTypes = {
  EP: "Epic",
  FE: "Feature",
  UC: "PBI",
  TASK: "Task",
  ISS: "Issue",
  Q: "Question",
  BUG: "Bug",
} as const satisfies Record<BacklogKind, string>;
const aliases = new Map<string, BacklogKind>(
  backlogKinds.flatMap((kind) => [
    [kind.toLowerCase(), kind],
    [hostTypes[kind].toLowerCase(), kind],
  ]),
);
aliases.set("frage", "Q");

export function backlogKind(value: unknown) {
  return typeof value === "string" ? aliases.get(value.trim().toLowerCase()) : undefined;
}

export function parentKind(kind: BacklogKind): BacklogKind | undefined {
  if (kind === "EP") return;
  return kind === "FE" ? "EP" : kind === "UC" ? "FE" : "UC";
}

export const backlogIdSchema = Schema.String.check(
  Schema.isPattern(
    /^(EP|FE|UC|TASK|ISS|Q|BUG)-(?:[0-9]+|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/,
  ),
);
export const isBacklogId = Schema.is(backlogIdSchema);
export const validBacklogTitle = Schema.is(lineOfText(160).check(Schema.isMinLength(1)));

export const backlogType = defineNoteType({
  type: "backlog",
  version: 1,
  fields: {
    project_id: required(text()),
    type: required(text()),
    title: text({ schema: lineOfText(160), issue: "backlog.title" }),
  },
  migrations: {},
});
export { boardStages, mappedBoardStage, normalizedBoardStage } from "./stages";
export type { BoardStage } from "./stages";
export {
  checkNfrDraft,
  nfrCategories,
  nfrCsvHeaders,
  nfrIdSchema,
  nfrStandards,
  nfrTitleKey,
  nfrType,
  previewNfrCsv,
} from "./nfr";
export type {
  NfrCategory,
  NfrCsvIssue,
  NfrCsvPreview,
  NfrDraft,
  NfrId,
  NfrInputIssue,
  NfrTarget,
} from "./nfr";
