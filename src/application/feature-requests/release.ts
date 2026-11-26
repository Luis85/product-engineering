import { Clock, Effect, Stream } from "effect";
import { nfrChanges } from "../backlog";
import { knowledgeChanges } from "../knowledge";
import type { ProjectId } from "../projects";
import { EventBus } from "../shell";
import { storyMapsChanges } from "../story-maps";
import { encodeRequestPackage } from "./delivery-package";
import { FeatureRequestError } from "./errors";
import { readRequestPackagePreview, requestPackageChanges } from "./package-inputs";
import type { FeatureRequest } from "./records";
import { featureRequestRevision, readRequestDelivery, storeRequestDelivery } from "./revisions";
import { changeFeatureRequest } from "./write";

export function releaseFeatureRequest(expected: FeatureRequest, basis: string) {
  return changeFeatureRequest(expected, (record, persist) =>
    Effect.gen(function* () {
      if (record.revision !== expected.revision || record.state !== "draft")
        return yield* new FeatureRequestError({ reason: "conflict" });
      const data = readRequestDelivery(record);
      if (!data || data.current.exportJson)
        return yield* new FeatureRequestError({ reason: "evidence" });
      const preview = yield* readRequestPackagePreview(record, true);
      if (!preview.ready) return yield* new FeatureRequestError({ reason: "readiness" });
      if (preview.basis !== basis) return yield* new FeatureRequestError({ reason: "stale" });
      const exportJson = yield* encodeRequestPackage(preview.package);
      const releasedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
      yield* persist({
        state: "released",
        blocker: undefined,
        ready_gates: preview.gates.ready,
        done_gates: preview.gates.done,
        delivery_data: storeRequestDelivery({
          ...data,
          current: { events: [], exportJson, releasedAt },
        }),
      });
    }),
  );
}

export function readFeatureRequestBaseline(record: FeatureRequest, revision = record.revision) {
  return Effect.gen(function* () {
    const history = featureRequestRevision(record, revision);
    if (!history?.package?.checksum) return;
    const live = yield* readRequestPackagePreview(record);
    return requestPackageChanges(history.package.package, live.package);
  });
}

const rawInputChanges = (requestPath: string | undefined) =>
  Stream.unwrap(
    EventBus.use(({ subscribe }) =>
      Effect.map(subscribe, (events) =>
        events.pipe(
          Stream.filter((event) => "extension" in event),
          Stream.filter(({ extension }) => /^(?:md|base)$/i.test(extension)),
          Stream.filter(({ path }) => path !== requestPath),
        ),
      ),
    ),
  );

export function requestInputChanges(project: ProjectId, requestPath?: string) {
  const signal = Stream.map(() => Symbol());
  const indexed = Stream.mergeAll(
    [
      nfrChanges(project).pipe(Stream.drop(1), signal),
      storyMapsChanges(project).pipe(Stream.drop(1), signal),
      knowledgeChanges.pipe(Stream.drop(1), signal),
    ],
    { concurrency: 3 },
  );
  return Stream.merge(rawInputChanges(requestPath).pipe(signal), indexed).pipe(
    Stream.debounce("150 millis"),
  );
}
