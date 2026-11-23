import { Effect } from "effect";
import { completePbiCriterion, pbiCriteria } from "../../domain/backlog";
import type { PbiCriterion, PbiCriterionDraft } from "../../domain/backlog";
import { IdGenerator } from "../notes";
import type { ProjectId } from "../projects";
import type { BacklogEdit } from "./edit";
import { BacklogError } from "./model";
import { savePbiContent } from "./pbi-storage";

export const newPbiCriterionIdentity = Effect.map(
  IdGenerator.use(({ nextId }) => nextId),
  (uuid) => ({ id: "AC-" + uuid, scenarioId: "SC-" + uuid }),
);
export type PbiCriterionIdentity = Effect.Success<typeof newPbiCriterionIdentity>;

export function savePbiCriterion(
  project: ProjectId,
  before: BacklogEdit,
  identity: PbiCriterionIdentity,
  draft: PbiCriterionDraft,
) {
  return Effect.gen(function* () {
    const all = pbiCriteria(before.item.fields.pbi_criteria);
    if (!all || !completePbiCriterion(draft))
      return yield* new BacklogError({ reason: "criteria" });
    const current = all.find(({ id }) => id === identity.id);
    if (current && current.scenario_id !== identity.scenarioId)
      return yield* new BacklogError({ reason: "criteria" });
    const next: PbiCriterion = {
      ...current,
      id: identity.id,
      text: draft.criterion.trim(),
      scenario_id: identity.scenarioId,
      scenario_name: draft.scenario.trim(),
      given: draft.given.trim(),
      when: draft.when.trim(),
      then_step: draft.then_step.trim(),
    };
    const criteria = current
      ? all.map((entry) => (entry === current ? next : entry))
      : [...all, next];
    if (!pbiCriteria(criteria)) return yield* new BacklogError({ reason: "criteria" });
    return yield* savePbiContent(project, before, { pbi_criteria: criteria });
  });
}
