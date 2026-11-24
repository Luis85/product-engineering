import { Effect } from "effect";
import { invalidRequestField, normalizeRequestScope } from "../../domain/feature-requests";
import { captureProjectReleaseRules } from "../projects";
import { FeatureRequestError } from "./errors";
import type { FeatureRequest } from "./records";
import { changeFeatureRequest } from "./write";

function sameDraft(expected: FeatureRequest, current: FeatureRequest) {
  return (
    current.state === "draft" &&
    current.revision === expected.revision &&
    current.scope === expected.scope &&
    current.pbiId === expected.pbiId
  );
}

export function editRequestScope(expected: FeatureRequest, value: string) {
  const scope = normalizeRequestScope(value);
  if (invalidRequestField("scope", scope))
    return Effect.fail(new FeatureRequestError({ reason: "scope" }));
  return changeFeatureRequest(expected, (current, persist) =>
    Effect.gen(function* () {
      if (!sameDraft(expected, current))
        return yield* new FeatureRequestError({ reason: "conflict" });
      if (scope !== current.scope)
        yield* persist({ scope, ready_checks: undefined, ready_check_version: undefined });
    }),
  );
}

export function confirmRequestReady(
  expected: FeatureRequest,
  criterionId: string,
  rulesVersion: number,
  confirmed: boolean,
) {
  return changeFeatureRequest(expected, (current, persist) =>
    Effect.gen(function* () {
      if (!sameDraft(expected, current))
        return yield* new FeatureRequestError({ reason: "conflict" });
      const definitions = yield* captureProjectReleaseRules(current.projectId);
      if (
        !definitions ||
        definitions.version !== rulesVersion ||
        !definitions.ready.some(({ id, type }) => id === criterionId && type === "manual")
      )
        return yield* new FeatureRequestError({ reason: "readiness" });
      const checks = new Set(
        current.manualChecks?.version === rulesVersion ? current.manualChecks.ids : [],
      );
      if (checks.has(criterionId) === confirmed) return;
      if (confirmed) checks.add(criterionId);
      else checks.delete(criterionId);
      yield* persist({ ready_checks: [...checks].toSorted(), ready_check_version: rulesVersion });
    }),
  );
}
