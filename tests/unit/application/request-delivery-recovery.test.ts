import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  canonicalRequestJson,
  confirmRequestReady,
  dispatchFeatureRequest,
  prepareRequestFollowup,
  readFeatureRequestRevision,
  readRequestPackagePreview,
  recordFactoryEvent,
  releaseFeatureRequest,
  replayFactoryEvent,
  replyToFactory,
  retryFeatureRequest,
  simulateFactoryEvent,
} from "../../../src/application/feature-requests";
import { rebuildNoteIndex } from "../../../src/application/notes";
import { encodeProjectReleaseRules } from "../../../src/domain/projects";
import {
  deliveryFixture,
  manual,
  project,
  request,
  scope,
  sha,
} from "../../support/request-delivery-fixture";

const otherProject = "project-33333333-3333-4333-8333-000000000482";
const otherRequest = "feature-request-33333333-3333-4333-8333-000000000492";
const otherChecksum = "b".repeat(64);

type Fixture = Awaited<ReturnType<typeof deliveryFixture>>;

async function release({ record, run }: Fixture) {
  await run(confirmRequestReady(await record(), manual, 3, true));
  const checked = await record();
  const preview = await run(readRequestPackagePreview(checked));
  await run(releaseFeatureRequest(checked, preview.basis));
  const current = await record();
  const revision = await run(readFeatureRequestRevision(project, request, current.revision));
  if (!revision?.exportJson || !revision.package?.checksum) throw new Error("Missing release");
  return {
    current,
    stored: revision.package,
    exportJson: revision.exportJson,
    checksum: revision.package.checksum.value,
  };
}

function replaceStoredExport({ run, store }: Fixture, path: string, exportJson: string) {
  return run(
    store.update(path, () =>
      Result.succeed({
        set: {
          delivery_data: canonicalRequestJson({ current: { events: [], exportJson }, history: [] }),
        },
      }),
    ),
  );
}

it("ignores misplaced callbacks and preserves the original evidence on conflicting replay", async () => {
  const f = await deliveryFixture();
  const { record, run } = f;
  try {
    const { current, stored, checksum } = await release(f);
    const command = {
      projectId: project,
      requestId: request,
      revision: 1,
      attempt: 1,
      checksum,
    } as const;
    const unacknowledged = await run(f.delivery.dispatch(command, stored.package));
    const pickup = await run(f.delivery.fixtureEvent(unacknowledged, stored.package, "pickup", 1));
    const question = await run(
      f.delivery.fixtureEvent(unacknowledged, stored.package, "question", 2),
    );
    if (pickup.kind !== "picked-up" || question.kind !== "question")
      throw new Error("Missing callbacks");

    expect(await run(recordFactoryEvent(pickup))).toBe("ignored");
    await expect(run(simulateFactoryEvent(current, "pickup"))).rejects.toMatchObject({
      reason: "delivery",
    });
    await expect(run(replayFactoryEvent(current, 1))).rejects.toMatchObject({ reason: "evidence" });
    expect(await run(dispatchFeatureRequest(current))).toEqual(unacknowledged);
    await Promise.all(
      ([{ projectId: otherProject }, { requestId: otherRequest }] as const).map((identity) =>
        expect(run(recordFactoryEvent({ ...pickup, ...identity }))).rejects.toMatchObject({
          reason: "identity",
        }),
      ),
    );
    await expect(run(recordFactoryEvent({ ...pickup, checksum: "invalid" }))).rejects.toMatchObject(
      { reason: "evidence" },
    );
    await Promise.all(
      [{ revision: 2 }, { runId: "unrelated-run" }, { attempt: 2 }].map((mismatch) =>
        expect(run(recordFactoryEvent({ ...pickup, ...mismatch }))).resolves.toBe("ignored"),
      ),
    );
    expect(await run(recordFactoryEvent(question))).toBe("ignored");
    expect(await record()).toMatchObject({ state: "queued", runId: unacknowledged.runId });
    expect(
      (await run(readFeatureRequestRevision(project, request, 1)))?.events.map(({ kind }) => kind),
    ).toEqual(["dispatched"]);

    expect(await run(recordFactoryEvent(pickup))).toBe("recorded");
    await expect(
      run(recordFactoryEvent({ ...pickup, worker: "Different worker" })),
    ).rejects.toMatchObject({ reason: "evidence" });
    expect(await run(replayFactoryEvent(await record(), 1))).toBe("duplicate");
    await Promise.all(
      [{ scope: "Another request's scope" }, { question: " \n" }].map((altered) =>
        expect(run(recordFactoryEvent({ ...question, ...altered }))).rejects.toMatchObject({
          reason: "evidence",
        }),
      ),
    );
    const afterInvalid = await run(readFeatureRequestRevision(project, request, 1));
    expect(afterInvalid?.state).toBe("running");
    expect(afterInvalid?.events).toHaveLength(2);
    expect(afterInvalid?.events.at(-1)).toEqual(pickup);

    expect(await run(recordFactoryEvent(question))).toBe("recorded");
    const waiting = await record();
    await expect(run(replyToFactory(waiting, question.id, " \r\n ", false))).rejects.toMatchObject({
      reason: "scope",
    });
    expect(await record()).toMatchObject({ state: "clarification" });
    await run(replyToFactory(waiting, question.id, "Use the confirmed cases from Monday", false));
    const clarified = await run(readFeatureRequestRevision(project, request, 1));
    expect(clarified).toMatchObject({ scope, state: "running", package: stored });
    expect(clarified?.events.at(-1)).toMatchObject({
      kind: "reply",
      questionId: question.id,
      reply: "Use the confirmed cases from Monday",
    });
  } finally {
    await f.host.runtime.dispose();
  }
});

it("keeps the release and failed attempt intact until attributable acknowledgements arrive", async () => {
  const f = await deliveryFixture();
  const { record, run } = f;
  try {
    const { current, exportJson } = await release(f);
    const wrongDispatchAcks = [
      { projectId: otherProject },
      { requestId: otherRequest },
      { revision: 2 },
      { attempt: 2 },
      { checksum: otherChecksum },
      { runId: "" },
    ] as const;
    for (const altered of wrongDispatchAcks) {
      f.dispatch.mockImplementationOnce((key, payload) =>
        Effect.map(f.delivery.dispatch(key, payload), (ack) => ({ ...ack, ...altered })),
      );
    }
    await Promise.all(
      wrongDispatchAcks.map(() =>
        expect(run(dispatchFeatureRequest(current))).rejects.toMatchObject({ reason: "evidence" }),
      ),
    );
    expect(await record()).toMatchObject({ state: "released" });
    expect(await run(readFeatureRequestRevision(project, request, 1))).toMatchObject({
      state: "released",
      events: [],
      exportJson,
    });
    await expect(run(retryFeatureRequest(current))).rejects.toMatchObject({ reason: "delivery" });
    const ack = await run(dispatchFeatureRequest(current));
    await expect(run(retryFeatureRequest(await record()))).rejects.toMatchObject({
      reason: "delivery",
    });
    await run(simulateFactoryEvent(await record(), "pickup"));
    await run(simulateFactoryEvent(await record(), "fail"));
    const failed = await record();
    await expect(run(retryFeatureRequest(current))).rejects.toMatchObject({ reason: "delivery" });
    f.dirty.add(f.prdPath);
    await expect(run(retryFeatureRequest(failed))).rejects.toMatchObject({ reason: "stale" });
    f.dirty.clear();
    expect(f.retry).not.toHaveBeenCalled();

    const wrongRetryAcks = [
      { runId: "replacement-run" },
      { attempt: 3 },
      { checksum: otherChecksum },
    ];
    for (const altered of wrongRetryAcks) {
      f.retry.mockImplementationOnce((previous) =>
        Effect.map(f.delivery.retry(previous), (next) => ({ ...next, ...altered })),
      );
    }
    await Promise.all(
      wrongRetryAcks.map(() =>
        expect(run(retryFeatureRequest(failed))).rejects.toMatchObject({ reason: "evidence" }),
      ),
    );
    const persisted = await run(readFeatureRequestRevision(project, request, 1));
    expect(persisted).toMatchObject({ state: "failed", run: ack, exportJson });
    expect(persisted?.events.map(({ kind }) => kind)).toEqual([
      "dispatched",
      "picked-up",
      "failed",
    ]);

    const retried = await run(retryFeatureRequest(failed));
    expect(retried).toEqual({ ...ack, attempt: 2 });
    expect(await run(replayFactoryEvent(await record(), 1))).toBe("ignored");
    expect(await run(readFeatureRequestRevision(project, request, 1))).toMatchObject({
      state: "queued",
      run: retried,
    });
    await run(simulateFactoryEvent(await record(), "pickup"));
    await run(simulateFactoryEvent(await record(), "fail"));
    await run(prepareRequestFollowup(await record()));
    await expect(run(dispatchFeatureRequest(current))).rejects.toMatchObject({
      reason: "conflict",
    });
    await expect(run(retryFeatureRequest(failed))).rejects.toMatchObject({ reason: "conflict" });
    await expect(run(simulateFactoryEvent(failed, "pickup"))).rejects.toMatchObject({
      reason: "conflict",
    });
    await expect(
      run(replyToFactory(failed, "older-question", "Another scope", true)),
    ).rejects.toMatchObject({ reason: "conflict" });
    expect(await run(replayFactoryEvent(await record(), 1))).toBe("ignored");
    expect(await run(readFeatureRequestRevision(project, request, 2))).toMatchObject({
      state: "draft",
      events: [],
    });
  } finally {
    await f.host.runtime.dispose();
  }
});

it("takes a request to review only for matching successful technical evidence", async () => {
  const f = await deliveryFixture();
  const { record, run } = f;
  try {
    const { current, stored } = await release(f);
    const ack = await run(dispatchFeatureRequest(current));
    await run(simulateFactoryEvent(await record(), "pickup"));
    const completion = await run(f.delivery.fixtureEvent(ack, stored.package, "verify", 2));
    if (completion.kind !== "verified") throw new Error("Missing technical callback");
    const { result } = completion;
    const [evidence] = result.evidence;
    if (!evidence) throw new Error("Missing acceptance criterion evidence");
    const invalidResults = [
      { pullRequest: "   " },
      { technicalReview: { ...result.technicalReview, commit: sha } },
      { evidence: [{ ...evidence, checkId: "" }] },
      { evidence: [{ ...evidence, commit: sha }] },
      { evidence: [{ ...evidence, outcome: "failed" as const }] },
      { evidence: [{ ...evidence, criterionId: "AC-99" }] },
      { evidence: [{ ...evidence, scenarioId: "SC-99" }] },
    ];
    await Promise.all(
      invalidResults.map((altered) =>
        expect(
          run(recordFactoryEvent({ ...completion, result: { ...result, ...altered } })),
        ).rejects.toMatchObject({ reason: "evidence" }),
      ),
    );
    const running = await run(readFeatureRequestRevision(project, request, 1));
    expect(running?.state).toBe("running");
    expect(running?.technical).toBeUndefined();
    expect(running?.doneGates).toContainEqual({ id: "base-done", status: "unavailable" });

    expect(await run(recordFactoryEvent(completion))).toBe("recorded");
    const reviewed = await run(readFeatureRequestRevision(project, request, 1));
    expect(reviewed).toMatchObject({ state: "review", technical: completion });
    expect(reviewed?.doneGates).toContainEqual({ id: "base-review", status: "open" });
    expect(reviewed?.decision).toBeUndefined();
  } finally {
    await f.host.runtime.dispose();
  }
});

it("reads a legacy package without a checksum and denies dispatch when frozen evidence cannot be verified", async () => {
  const f = await deliveryFixture();
  const { record, run } = f;
  try {
    const { current, stored } = await release(f);
    const { nfrs: _nfrs, domain: _domain, ...legacyPackage } = stored.package;
    const legacyExport = JSON.stringify({ package: legacyPackage }, undefined, 2);
    await replaceStoredExport(f, current.path, legacyExport);
    expect(await run(readFeatureRequestRevision(project, request, 1))).toMatchObject({
      exportJson: legacyExport,
      package: { package: legacyPackage },
    });
    await expect(run(dispatchFeatureRequest(await record()))).rejects.toMatchObject({
      reason: "evidence",
    });
    await replaceStoredExport(
      f,
      current.path,
      canonicalRequestJson({ ...stored, package: { ...stored.package, externalExtra: true } }),
    );
    await expect(run(dispatchFeatureRequest(await record()))).rejects.toMatchObject({
      reason: "evidence",
    });
    expect(
      (await run(readFeatureRequestRevision(project, request, 1)))?.exportJson,
    ).toBeUndefined();

    await replaceStoredExport(
      f,
      current.path,
      canonicalRequestJson({ ...stored, package: { ...stored.package, scope: "Tampered scope" } }),
    );
    await expect(run(dispatchFeatureRequest(await record()))).rejects.toMatchObject({
      reason: "evidence",
    });
    expect(f.dispatch).not.toHaveBeenCalled();

    await replaceStoredExport(f, current.path, legacyExport);
    await run(prepareRequestFollowup(await record()));
    expect(await run(readFeatureRequestRevision(project, request, 1))).toMatchObject({
      isCurrent: false,
      exportJson: legacyExport,
      package: { package: legacyPackage },
    });
    const draft = await run(readFeatureRequestRevision(project, request, 2));
    expect(draft).toMatchObject({ isCurrent: true, state: "draft", events: [] });
    expect(draft?.exportJson).toBeUndefined();
  } finally {
    await f.host.runtime.dispose();
  }
});

it.each([
  { field: "project", identity: { projectId: otherProject } },
  { field: "request", identity: { id: otherRequest } },
  { field: "revision", identity: { revision: 2 } },
])(
  "keeps a package with the wrong $field out of the revision and dispatch",
  async ({ identity }) => {
    const f = await deliveryFixture();
    const { record, run } = f;
    try {
      const { current, stored } = await release(f);
      await replaceStoredExport(
        f,
        current.path,
        canonicalRequestJson({
          ...stored,
          package: { ...stored.package, request: { ...stored.package.request, ...identity } },
        }),
      );
      const misattributed = await run(readFeatureRequestRevision(project, request, 1));
      expect(misattributed?.state).toBe("released");
      expect(misattributed?.package).toBeUndefined();
      expect(misattributed?.exportJson).toBeUndefined();
      await expect(run(dispatchFeatureRequest(await record()))).rejects.toMatchObject({
        reason: "evidence",
      });
      expect(f.dispatch).not.toHaveBeenCalled();
    } finally {
      await f.host.runtime.dispose();
    }
  },
);

it.each([
  { removed: false, work: "open", bug: "open", task: "passed" },
  { removed: true, work: "unavailable", bug: "unavailable", task: "unavailable" },
])(
  "evaluates Done against the frozen work scope when a scoped bug was removed = $removed",
  async ({ removed, work, bug, task }) => {
    const f = await deliveryFixture();
    const { p, record, run, store } = f;
    try {
      const done = [
        {
          id: "project-criterion-33333333-3333-4333-8333-000000000451",
          type: "scope",
          title: "Scope recorded",
          enabled: true,
        },
        {
          id: "project-criterion-33333333-3333-4333-8333-000000000452",
          type: "manual",
          title: "Human approval",
          enabled: true,
        },
        {
          id: "project-criterion-33333333-3333-4333-8333-000000000453",
          type: "open-work",
          title: "Work settled",
          enabled: true,
        },
        {
          id: "project-criterion-33333333-3333-4333-8333-000000000454",
          type: "open-bug",
          title: "Bugs settled",
          enabled: true,
        },
        {
          id: "project-criterion-33333333-3333-4333-8333-000000000455",
          type: "open-task",
          title: "Tasks settled",
          enabled: true,
        },
      ] as const;
      await run(
        store.update(p.notePath, () =>
          Result.succeed({
            set: {
              release_rules: encodeProjectReleaseRules({
                version: 3,
                ready: [{ id: manual, title: "Selection checked", type: "manual", enabled: true }],
                done,
              }),
            },
          }),
        ),
      );
      const bugPath = p.folder + "/BUG-01.md";
      await run(
        f.host.notes.seed(bugPath, {
          project_id: project,
          type: "Bug",
          "pe-id": "BUG-01",
          parent: "[[UC-09]]",
          status: "Open",
        }),
      );
      await run(rebuildNoteIndex);
      const { current, stored } = await release(f);
      expect(stored.package.workIds).toEqual(["BUG-01"]);
      if (removed) await run(f.host.notes.removeOutside(bugPath));
      await run(
        f.host.notes.seed(p.folder + "/TASK-02.md", {
          project_id: project,
          type: "Task",
          "pe-id": "TASK-02",
          parent: "[[UC-09]]",
          status: "Open",
        }),
      );
      await run(rebuildNoteIndex);
      await run(dispatchFeatureRequest(current));
      await run(simulateFactoryEvent(await record(), "pickup"));
      await run(simulateFactoryEvent(await record(), "verify"));
      const reviewed = await run(readFeatureRequestRevision(project, request, 1));
      expect(reviewed?.state).toBe("review");
      expect(reviewed?.doneGates).toMatchObject([
        { id: "base-done", status: "passed" },
        { id: "base-review", status: "open" },
        { id: done[0].id, status: "passed" },
        { id: done[1].id, status: "open" },
        { id: done[2].id, status: work },
        { id: done[3].id, status: bug },
        { id: done[4].id, status: task },
      ]);
    } finally {
      await f.host.runtime.dispose();
    }
  },
);
