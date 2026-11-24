import { Result, Schema } from "effect";
import { backlogIdSchema } from "../backlog";
import {
  defineNoteType,
  lineOfText,
  number,
  recordIdIssue,
  recordList,
  required,
  text,
} from "../notes";
import { projectIdSchema } from "../projects";

export const featureRequestIdSchema = Schema.TemplateLiteral([
  "feature-request-",
  Schema.String,
]).check(Schema.makeFilter((value) => recordIdIssue("feature-request", value) === undefined));
export const isFeatureRequestId = Schema.is(featureRequestIdSchema);
export type FeatureRequestId = typeof featureRequestIdSchema.Type;

export const pbiIdSchema = backlogIdSchema.check(Schema.isPattern(/^UC-/));
export const isRequestPbiId = Schema.is(pbiIdSchema);
const requestStates = [
  "draft",
  "released",
  "queued",
  "running",
  "clarification",
  "failed",
  "review",
  "changes-requested",
  "accepted",
  "closed",
] as const;
export const deliveryStages = ["draft", "blocked", "ready", "factory", "review", "done"] as const;
export type DeliveryStage = (typeof deliveryStages)[number];

const nonBlank = Schema.makeFilter((value: string) => Boolean(value.trim()));
const positive = number({
  schema: Schema.Int.check(
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
  issue: "revision.invalid",
});
export const requestTitleLimit = 160;
export const requestScopeLimit = 12000;
const gateCheck = Schema.Struct({
  id: lineOfText(160).check(nonBlank),
  title: Schema.optionalKey(lineOfText(160).check(nonBlank)),
  status: Schema.Literals(["passed", "open", "unavailable"]),
});
export type RequestGate = typeof gateCheck.Type;
const gateEvidence = recordList({
  schema: Schema.Array(gateCheck).check(
    Schema.makeFilter((entries) => new Set(entries.map(({ id }) => id)).size === entries.length),
  ),
  issue: "gates.invalid",
});

export const featureRequestType = defineNoteType({
  type: "feature-request",
  version: 1,
  folder: "Feature Requests",
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    display_id: required(
      text({
        schema: lineOfText(32).check(Schema.isPattern(/^FR-[0-9]{2,}$/)),
        issue: "id.invalid",
      }),
    ),
    pbi_id: required(text({ schema: pbiIdSchema, issue: "pbi.invalid" })),
    title: required(
      text({ schema: lineOfText(requestTitleLimit).check(nonBlank), issue: "title.invalid" }),
    ),
    scope: required(
      text({
        schema: Schema.String.check(Schema.isMaxLength(requestScopeLimit), nonBlank),
        issue: "scope.invalid",
      }),
    ),
    sequence: required(positive),
    revision: required(positive),
    state: required(text({ schema: Schema.Literals(requestStates), issue: "state.invalid" })),
    run_id: text({ schema: lineOfText(160).check(nonBlank), issue: "run.invalid" }),
    blocker: text({
      schema: Schema.Literals(["stale-inputs", "dispatch-evidence", "review-evidence"]),
      issue: "blocker.invalid",
    }),
    ready_gates: gateEvidence,
    done_gates: gateEvidence,
  },
  migrations: {},
});

export function normalizeRequestScope(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function invalidRequestField(field: "title" | "scope", value: string) {
  return Result.isFailure(featureRequestType.fields[field].check(value));
}
