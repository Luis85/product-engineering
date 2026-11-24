import { Effect, Layer } from "effect";
import { FeatureRequestDelivery } from "../../application/feature-requests";
import type { FactoryAcknowledgement, FactoryCallback } from "../../application/feature-requests";

function fixtureRun(request: Omit<FactoryAcknowledgement, "provider" | "runId">) {
  return {
    ...request,
    runId: `LOCAL-${request.requestId.slice(-12)}-${request.revision}`,
    provider: "local-fixture",
  } as const;
}

async function testedCommit(run: FactoryAcknowledgement) {
  const text = `fixture:${run.projectId}:${run.runId}:${run.attempt}:${run.checksum}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const localFactoryFixture = Layer.succeed(FeatureRequestDelivery, {
  dispatch: (request) => Effect.succeed(fixtureRun(request)),
  retry: (run) => Effect.succeed({ ...run, attempt: run.attempt + 1 }),
  fixtureEvent: (run, payload, action, eventNumber) =>
    Effect.promise(async (): Promise<FactoryCallback> => {
      const key = { ...run, id: `${run.runId}:${run.attempt}:${eventNumber}:${action}` };
      switch (action) {
        case "pickup":
          return { ...key, kind: "picked-up", worker: `Local ${run.attempt}` };
        case "question":
          return { ...key, kind: "question", question: "scope-confirmation", scope: payload.scope };
        case "fail":
          return { ...key, kind: "failed", reason: "lease-expired" };
        case "verify": {
          const commit = await testedCommit(run);
          const evidence = (payload.useCase?.criteria ?? []).map(({ id, scenario_id }) => ({
            criterionId: id,
            scenarioId: scenario_id,
            commit,
            outcome: "passed" as const,
            checkId: `local:${run.attempt}:${scenario_id}`,
          }));
          return {
            ...key,
            kind: "verified",
            result: {
              pullRequest: `LOCAL-PR-${run.runId.slice(6)}`,
              commit,
              technicalReview: { verdict: "approved", commit },
              evidence,
            },
          };
        }
      }
    }),
});
