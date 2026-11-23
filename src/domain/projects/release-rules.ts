import { Result, Schema } from "effect";
import { lineOfText, recordIdIssue } from "../notes";

export const projectGatePhases = ["ready", "done"] as const;
export type ProjectGatePhase = (typeof projectGatePhases)[number];
export const projectCriterionTypes = [
  "manual",
  "scope",
  "open-work",
  "open-task",
  "open-issue",
  "open-bug",
] as const;
export const projectBaseChecks = {
  ready: ["base-ready", "base-git"],
  done: ["base-done", "base-review"],
} as const satisfies Record<ProjectGatePhase, readonly string[]>;
export type ProjectBaseCheck = (typeof projectBaseChecks)[ProjectGatePhase][number];
export const projectCriterionIdSchema = Schema.TemplateLiteral([
  "project-criterion-",
  Schema.String,
]).check(Schema.makeFilter((id) => recordIdIssue("project-criterion", id) === undefined));
export type ProjectCriterionId = typeof projectCriterionIdSchema.Type;
export const isProjectCriterionId = Schema.is(projectCriterionIdSchema);

const title = lineOfText(130).check(
  Schema.isMinLength(1),
  Schema.makeFilter((value) => value === value.trim()),
);
const type = Schema.Literals(projectCriterionTypes);
const criterion = Schema.Struct({
  id: projectCriterionIdSchema,
  title,
  type,
  enabled: Schema.Boolean,
});
export type ProjectCriterionType = typeof type.Type;
export type ProjectCriterion = typeof criterion.Type;
export type ProjectCriterionDraft = Omit<ProjectCriterion, "id">;
export const isCriterionTitle = Schema.is(title);
export const isCriterionType = Schema.is(type);

const ruleSet = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Number.check(
      Schema.makeFilter((value) => Number.isSafeInteger(value) && value >= 1),
    ),
    ready: Schema.Array(criterion),
    done: Schema.Array(criterion),
  }).check(
    Schema.makeFilter(({ ready, done }) => {
      const all = [...ready, ...done];
      return new Set(all.map(({ id }) => id)).size === all.length;
    }),
  ),
);
export type ProjectReleaseRules = typeof ruleSet.Type;
const decode = Schema.decodeUnknownResult(ruleSet);
export const encodeProjectReleaseRules = Schema.encodeSync(ruleSet);
export const projectReleaseRulesField = {
  check(input: unknown) {
    return input === undefined || input === null
      ? Result.succeed(undefined)
      : Result.mapError(decode(input), () => "release_rules.invalid" as const);
  },
};

export const defaultProjectReleaseRules = (): ProjectReleaseRules => ({
  version: 1,
  ready: [],
  done: [],
});
