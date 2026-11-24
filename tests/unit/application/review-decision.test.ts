import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import {
  acceptReview,
  canonicalRequestJson,
  confirmRequestReady,
  confirmReviewCheck,
  dispatchFeatureRequest,
  prepareRequestFollowup,
  readReviewWorkspace,
  readRequestPackagePreview,
  releaseFeatureRequest,
  requestReviewChange,
  simulateFactoryEvent,
} from "../../../src/application/feature-requests";
import { encodeProjectReleaseRules } from "../../../src/domain/projects";
import {
  deliveryFixture,
  criterion,
  manual,
  project,
  request,
} from "../../support/request-delivery-fixture";

type Fixture = Awaited<ReturnType<typeof deliveryFixture>>;

async function testedFixture(configure?: (fixture: Fixture) => Promise<void>) {
  const fixture = await deliveryFixture();
  const { record, run } = fixture;
  await configure?.(fixture);
  await run(confirmRequestReady(await record(), manual, 3, true));
  const draft = await record();
  await run(releaseFeatureRequest(draft, (await run(readRequestPackagePreview(draft))).basis));
  await run(dispatchFeatureRequest(await record()));
  await run(simulateFactoryEvent(await record(), "pickup"));
  await run(simulateFactoryEvent(await record(), "verify"));
  const current = await record();
  const read = () => run(readReviewWorkspace(project, request, 1));
  const initial = await read();
  if (!initial?.target || !initial.receipt) throw new Error("Missing exact receipt");
  return { ...fixture, read, current, initial, target: initial.target, receipt: initial.receipt };
}

it("reports a known revision with malformed or unrelated receipts and retains strict write guards", async () => {
  const f = await testedFixture();
  try {
    const { run, current, receipt, read, target, store } = f;
    const delivery = JSON.parse(current.deliveryData ?? "") as {
      current: { events: readonly unknown[]; exportJson: string; run: Record<string, unknown> };
      history: readonly unknown[];
    };
    const replace = (fields: Partial<typeof delivery.current>) =>
      run(
        store.update(current.path, () =>
          Result.succeed({
            set: {
              delivery_data: canonicalRequestJson({
                ...delivery,
                current: { ...delivery.current, ...fields },
              }),
            },
          }),
        ),
      );
    const { commit: _commit, technicalReview, ...partial } = receipt.result;
    await replace({ events: [{ ...receipt, result: partial }] });
    expect(await read()).toMatchObject({
      blocker: "commit",
      entry: { isCurrent: true },
      ciPassed: false,
    });
    await expect(run(requestReviewChange(target, "Needs correction"))).rejects.toMatchObject({
      reason: "conflict",
    });

    await replace({ events: [{ ...receipt, result: { ...partial, commit: target.commit } }] });
    expect(await read()).toMatchObject({
      blocker: "technical",
      testedCommit: target.commit,
      ciPassed: true,
    });
    await replace({
      events: [
        {
          ...receipt,
          result: {
            ...receipt.result,
            technicalReview: { ...technicalReview, commit: "2".repeat(40) },
          },
        },
      ],
    });
    expect(await read()).toMatchObject({
      blocker: "technical",
      technicalApproved: false,
      ciPassed: true,
    });

    await replace({ events: [{ ...receipt, result: { ...receipt.result, evidence: [] } }] });
    expect(await read()).toMatchObject({ blocker: "ci", technicalApproved: true, ciPassed: false });
    await replace({ run: { ...delivery.current.run, revision: 4 } });
    expect(await read()).toMatchObject({ blocker: "run", technicalApproved: false });
    await replace({ exportJson: "{ broken" });
    expect(await read()).toMatchObject({ blocker: "package", entry: { invalidPackage: true } });
    await replace({});
    await expect(run(requestReviewChange(target, " \r\n\t "))).rejects.toMatchObject({
      reason: "review-reason",
    });
    expect(await read()).toMatchObject({ blocker: undefined, confirmed: 0 });
  } finally {
    await f.host.runtime.dispose();
  }
});

const manualDone = "project-criterion-33333333-3333-4333-8333-000000000411";
const bugs = "project-criterion-33333333-3333-4333-8333-000000000412";
const work = "project-criterion-33333333-3333-4333-8333-000000000413";

function addCompanion(f: Fixture, id: string, type: string, status: string) {
  return f.seed(
    f.p.folder + "/" + id + ".md",
    {
      project_id: project,
      "pe-id": id,
      title: id,
      type,
      status,
      parent: "[[UC-09]]",
    },
    "",
  );
}

it("uses frozen Done policy with the canonical released and current companion work", async () => {
  const f = await testedFixture(async (fixture) => {
    const rules = encodeProjectReleaseRules({
      version: 3,
      ready: [{ id: manual, title: "Selection checked", type: "manual", enabled: true }],
      done: [
        { id: manualDone, title: "Verify all rows", type: "manual", enabled: true },
        { id: bugs, title: "Close the bugs", type: "open-bug", enabled: true },
        { id: work, title: "Complete related work", type: "open-work", enabled: true },
      ],
    });
    await fixture.run(
      fixture.store.update(fixture.p.notePath, () =>
        Result.succeed({ set: { release_rules: rules } }),
      ),
    );
    await addCompanion(fixture, "BUG-01", "Bug", "Done");
  });
  try {
    const { run, target, read, store } = f;
    await addCompanion(f, "TASK-05", "Task", "Open");
    await run(confirmReviewCheck(target, "manual", manualDone, true));
    await run(confirmReviewCheck(target, "criteria", criterion.id, true));
    expect(await read()).toMatchObject({
      workByGate: {
        [bugs]: [{ id: "BUG-01", state: "Done" }],
        [work]: [
          { id: "BUG-01", state: "Done" },
          { id: "TASK-05", state: "Open" },
        ],
      },
    });
    await expect(run(acceptReview(target))).rejects.toMatchObject({ reason: "review-done" });
    await run(store.trash(f.p.folder + "/BUG-01.md"));
    expect(await read()).toMatchObject({
      workByGate: { [bugs]: [{ id: "BUG-01", issue: "missing" }] },
    });
    await addCompanion(f, "BUG-01", "Bug", "Done");
    await run(
      store.update(f.p.folder + "/TASK-05.md", () => Result.succeed({ set: { status: "Done" } })),
    );
    await run(
      store.update(f.p.notePath, () =>
        Result.succeed({
          set: { release_rules: encodeProjectReleaseRules({ version: 4, ready: [], done: [] }) },
        }),
      ),
    );
    await run(acceptReview(target));
    expect((await read())?.entry.decision?.proof).toMatchObject({
      manual: [manualDone],
      work: [
        { id: "BUG-01", state: "Done" },
        { id: "TASK-05", state: "Done" },
      ],
    });
  } finally {
    await f.host.runtime.dispose();
  }
});

it("guards confirmations and commits one acceptance with exact evidence and archival history", async () => {
  const f = await testedFixture();
  try {
    const { run, target, store, current, read } = f;
    const original = await run(store.readContent(current.path));
    expect(f.initial).toMatchObject({ confirmed: 0, ciPassed: true, technicalApproved: true });
    expect(f.initial.entry.decision).toBeUndefined();
    await expect(run(acceptReview(target))).rejects.toMatchObject({ reason: "review-done" });
    await expect(
      run(confirmReviewCheck(target, "criteria", "foreign", true)),
    ).rejects.toMatchObject({
      reason: "evidence",
    });
    expect((await run(store.readContent(current.path))).text).toBe(original.text);

    await run(confirmReviewCheck(target, "criteria", criterion.id, true));
    await run(confirmReviewCheck(target, "criteria", criterion.id, false));
    expect(await read()).toMatchObject({ confirmed: 0 });
    await run(confirmReviewCheck(target, "criteria", criterion.id, true));
    const confirmed = await run(store.readContent(current.path));
    await run(confirmReviewCheck(target, "criteria", criterion.id, true));
    expect((await run(store.readContent(current.path))).text).toBe(confirmed.text);

    const outcomes = await Promise.allSettled([
      run(acceptReview(target)),
      run(acceptReview(target)),
    ]);
    expect(outcomes.map(({ status }) => status).toSorted()).toEqual(["fulfilled", "rejected"]);
    expect(await read()).toMatchObject({
      confirmed: 1,
      entry: {
        state: "accepted",
        decision: {
          commit: target.commit,
          proof: {
            revision: 1,
            criteria: [criterion.id],
            checksum: target.checksum,
            gates: [
              { id: "base-done", status: "passed" },
              { id: "base-review", status: "passed" },
            ],
          },
        },
      },
    });
    expect((await read())?.entry.decision?.proof?.decidedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await run(prepareRequestFollowup(await f.record()));
    await expect(
      run(confirmReviewCheck(target, "criteria", criterion.id, false)),
    ).rejects.toMatchObject({
      reason: "conflict",
    });
    expect(await read()).toMatchObject({
      blocker: "previous",
      confirmed: 1,
      entry: { state: "accepted" },
    });
  } finally {
    await f.host.runtime.dispose();
  }
});

it("rechecks the fresh source and exact current receipt before writing an in-flight confirmation", async () => {
  const f = await testedFixture();
  try {
    const { run, target, receipt, store, current, read } = f;
    const original = await run(store.readContent(current.path));
    f.dirty.add(f.prdPath);
    expect(await read()).toMatchObject({ blocker: "stale" });
    await expect(
      run(confirmReviewCheck(target, "criteria", criterion.id, true)),
    ).rejects.toMatchObject({
      reason: "stale",
    });
    expect((await run(store.readContent(current.path))).text).toBe(original.text);
    f.dirty.clear();

    const delivery = JSON.parse(current.deliveryData ?? "") as {
      current: { events: readonly unknown[] };
      history: readonly unknown[];
    };
    const mismatched = { ...receipt, attempt: receipt.attempt + 1 };
    await run(
      store.update(current.path, () =>
        Result.succeed({
          set: {
            delivery_data: canonicalRequestJson({
              ...delivery,
              current: { ...delivery.current, events: [mismatched] },
            }),
          },
        }),
      ),
    );
    expect(await read()).toMatchObject({ blocker: "receipt", ciPassed: false });
    await expect(
      run(Effect.result(confirmReviewCheck(target, "criteria", criterion.id, true))),
    ).resolves.toMatchObject({ failure: { reason: "conflict" } });
  } finally {
    await f.host.runtime.dispose();
  }
});
