import { Effect, Stream } from "effect";
import { featureRequestsChanges, requestInputChanges } from "../feature-requests";
import type { ProjectId } from "../projects";
import { readTraceDelivery } from "./delivery";
import { readTraceSources } from "./source";

export function traceChanges(project: ProjectId) {
  return Stream.merge(
    requestInputChanges(project),
    Stream.map(featureRequestsChanges(project), () => Symbol()),
  );
}

export function readTrace(projectId: ProjectId, key: string) {
  return Effect.gen(function* () {
    const source = yield* readTraceSources(projectId, key);
    if (!source) return;
    const delivery = source.detail ? yield* readTraceDelivery(source.detail) : undefined;
    return { projectId, key, source, delivery };
  });
}

export type PbiTrace = NonNullable<Effect.Success<ReturnType<typeof readTrace>>>;
