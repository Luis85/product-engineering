import { expect, it } from "vitest";
import {
  canonicalRequestJson,
  confirmRequestReady,
  dispatchFeatureRequest,
  featureRequestReview,
  featureRequestRevision,
  prepareRequestFollowup,
  readRequestPackagePreview,
  releaseFeatureRequest,
  reviewRegisterSnapshot,
  simulateFactoryEvent,
} from "../../../src/application/feature-requests";
import type {
  FeatureRequest,
  FeatureRequestRevision,
} from "../../../src/application/feature-requests";
import { deliveryFixture, manual, project, request } from "../../support/request-delivery-fixture";

function withJournal(record: FeatureRequest, current: Partial<FeatureRequestRevision>) {
  return { ...record, deliveryData: canonicalRequestJson({ current, history: [] }) };
}

async function verifiedReview(f: Awaited<ReturnType<typeof deliveryFixture>>) {
  const { record, run } = f;
  const draft = await record();
  expect(await run(reviewRegisterSnapshot(project))).toMatchObject({ rows: [], ready: true });
  await run(confirmRequestReady(draft, manual, 3, true));
  const confirmed = await record();
  await run(
    releaseFeatureRequest(confirmed, (await run(readRequestPackagePreview(confirmed))).basis),
  );
  await run(dispatchFeatureRequest(await record()));
  await run(simulateFactoryEvent(await record(), "pickup"));
  await run(simulateFactoryEvent(await record(), "verify"));
  const verified = await record();
  const entry = featureRequestRevision(verified, 1);
  if (!entry?.run || !entry.technical) throw new Error("Missing verification fixture");
  const { technical, run: acknowledgement } = entry;
  const row = {
    projectId: project,
    requestId: request,
    revision: 1,
    business: "review",
    testedCommit: technical.result.commit,
    technicalApproved: true,
    ciPassed: true,
  };
  return { verified, entry, technical, acknowledgement, row };
}

const otherCommit = "1".repeat(40);

it("projects only matching tested evidence and preserves exact commit during baseline changes and follow-up", async () => {
  const f = await deliveryFixture();
  const { record, run, host } = f;
  try {
    const { verified, entry, technical, acknowledgement, row } = await verifiedReview(f);
    expect((await run(reviewRegisterSnapshot(project))).rows).toMatchObject([
      { ...row, stale: false },
    ]);
    f.dirty.add(f.prdPath);
    expect((await run(reviewRegisterSnapshot(project))).rows).toMatchObject([
      { ...row, stale: true },
    ]);

    const wrongEvent = [
      { projectId: "project-33333333-3333-4333-8333-000000000777" },
      { requestId: "feature-request-33333333-3333-4333-8333-000000000777" },
      { revision: 2 },
      { runId: "unrelated-run" },
      { attempt: technical.attempt + 1 },
      { checksum: "0".repeat(64) },
    ] as const;
    for (const mismatch of wrongEvent) {
      expect(
        featureRequestReview(
          withJournal(verified, { ...entry, events: [{ ...technical, ...mismatch }] }),
          1,
        ),
      ).toBeUndefined();
    }
    expect(
      featureRequestReview(
        withJournal(verified, { ...entry, run: { ...acknowledgement, revision: 2 } }),
        1,
      ),
    ).toBeUndefined();
    expect(
      featureRequestReview(withJournal(verified, { ...entry, exportJson: "broken" }), 1),
    ).toBeUndefined();

    await run(prepareRequestFollowup(verified));
    const current = await record();
    expect(featureRequestReview(current, current.revision)).toBeUndefined();
    expect(featureRequestReview(current, 1)?.row).toMatchObject(row);
    expect(await run(reviewRegisterSnapshot(project))).toMatchObject({ rows: [], ready: true });
  } finally {
    await host.runtime.dispose();
  }
});

it("reports technical approval, passing CI and documented business decisions independently", async () => {
  const f = await deliveryFixture();
  try {
    const { verified, entry, technical, acknowledgement, row } = await verifiedReview(f);
    const accepted = { ...verified, state: "accepted" } as const;
    const decision = {
      decision: "accepted",
      runId: acknowledgement.runId,
      attempt: acknowledgement.attempt,
      commit: technical.result.commit,
      explanation: "",
    } as const;
    expect(
      featureRequestReview(withJournal(accepted, { ...entry, decision }), 1)?.row.business,
    ).toBe("accepted");
    expect(
      featureRequestReview(
        withJournal(accepted, { ...entry, decision: { ...decision, commit: otherCommit } }),
        1,
      )?.row.business,
    ).toBe("review");
    expect(featureRequestReview(accepted, 1)).toMatchObject({
      row: { business: "review" },
      evidence: { state: "review" },
    });
    const resultWithoutCI = { ...technical.result, evidence: [] };
    const noCI = withJournal(verified, {
      ...entry,
      events: [{ ...technical, result: resultWithoutCI }],
    });
    expect(featureRequestReview(noCI, 1)?.row).toMatchObject({ ...row, ciPassed: false });
    const wrongApproval = withJournal(verified, {
      ...entry,
      events: [
        {
          ...technical,
          result: {
            ...technical.result,
            technicalReview: { ...technical.result.technicalReview, commit: otherCommit },
          },
        },
      ],
    });
    expect(featureRequestReview(wrongApproval, 1)?.row).toMatchObject({
      ...row,
      technicalApproved: false,
    });

    const change = { ...verified, state: "changes-requested" } as const;
    const scopeChange = {
      ...acknowledgement,
      id: "scope-change",
      kind: "scope-change",
      questionId: "question",
      reply: "Use the approved filters",
    } as const;
    expect(featureRequestReview(withJournal(change, { ...entry, events: [] }), 1)).toBeUndefined();
    expect(
      featureRequestReview(withJournal(change, { ...entry, events: [scopeChange] }), 1)?.row,
    ).toMatchObject({ business: "changes-requested", technicalApproved: false, ciPassed: false });
    const documented = {
      ...decision,
      decision: "changes-requested",
      explanation: scopeChange.reply,
    } as const;
    expect(
      featureRequestReview(withJournal(change, { ...entry, events: [], decision: documented }), 1)
        ?.row,
    ).toMatchObject({ business: "changes-requested", testedCommit: undefined });
    expect(
      featureRequestReview(
        withJournal(change, {
          ...entry,
          events: [],
          decision: { ...documented, explanation: " " },
        }),
        1,
      ),
    ).toBeUndefined();
  } finally {
    await f.host.runtime.dispose();
  }
});
