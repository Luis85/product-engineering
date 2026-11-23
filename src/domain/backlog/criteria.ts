import { Schema } from "effect";
import { lineOfText } from "../notes";

const suffix = /^(?:AC|SC)-(?:\d+|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/;
const specificationId = (prefix: string) =>
  Schema.String.check(Schema.isPattern(suffix), Schema.isPattern(new RegExp("^" + prefix)));
const criterion = Schema.Struct({
  id: specificationId("AC-"),
  text: Schema.String,
  scenario_id: specificationId("SC-"),
  scenario_name: Schema.String,
  given: Schema.String,
  when: Schema.String,
  then_step: Schema.String,
});
const readCriteria = Schema.is(Schema.Array(criterion));
const validLine = Schema.is(lineOfText(400).check(Schema.isMinLength(1)));

export type PbiCriterion = typeof criterion.Type;
export type PbiCriterionDraft = {
  criterion: string;
  scenario: string;
  given: string;
  when: string;
  then_step: string;
};

export function pbiCriterionDraft(value?: PbiCriterion): PbiCriterionDraft {
  if (!value) return { criterion: "", scenario: "", given: "", when: "", then_step: "" };
  return {
    criterion: value.text,
    scenario: value.scenario_name,
    given: value.given,
    when: value.when,
    then_step: value.then_step,
  };
}

export function completePbiCriterion(draft: PbiCriterionDraft) {
  return Object.values(draft).every((line) => validLine(line.trim()));
}

export function pbiCriteria(value: unknown): readonly PbiCriterion[] | undefined {
  if (value === undefined) return [];
  if (!readCriteria(value)) return;
  const ids = new Set(value.flatMap(({ id, scenario_id }) => [id, scenario_id]));
  if (ids.size === value.length * 2) return value;
}

const keywords = {
  en: ["Feature", "Scenario", "Given", "When", "Then"],
  de: ["Funktionalität", "Szenario", "Angenommen", "Wenn", "Dann"],
} as const;

export function pbiFeature(
  { id, title }: { readonly id: string; readonly title: string },
  criteria: readonly PbiCriterion[],
  language: keyof typeof keywords,
) {
  const [feature, scenario, given, when, then] = keywords[language];
  const scenarios = criteria.filter((entry) => completePbiCriterion(pbiCriterionDraft(entry)));
  if (!scenarios.length) return "";
  return [
    `# language: ${language}`,
    `${feature}: ${title}`,
    ...scenarios.map(({ id: criterionId, text, ...steps }) =>
      [
        "",
        `  # ${text.trim()}`,
        `  @${id} @${criterionId} @${steps.scenario_id}`,
        `  ${scenario}: ${steps.scenario_name.trim()}`,
        `    ${given} ${steps.given.trim()}`,
        `    ${when} ${steps.when.trim()}`,
        `    ${then} ${steps.then_step.trim()}`,
      ].join("\n"),
    ),
    "",
  ].join("\n");
}
