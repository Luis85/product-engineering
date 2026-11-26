import { createHash } from "node:crypto";
import { Result } from "effect";
import { expect, it } from "vitest";
import { pbiBoardStage } from "../../../src/application/backlog";
import {
  canonicalRequestJson,
  confirmRequestReady,
  dispatchFeatureRequest,
  editRequestScope,
  featureRequestsForPbi,
  prepareRequestFollowup,
  readFeatureRequestRevision,
  readRequestPackagePreview,
  recordFactoryEvent,
  releaseFeatureRequest,
  replyToFactory,
  retryFeatureRequest,
  simulateFactoryEvent,
  verifyRequestPackage,
} from "../../../src/application/feature-requests";
import {
  criterion,
  deliveryFixture,
  manual,
  pbiId,
  prd,
  project,
  request,
  scope,
  sha,
} from "../../support/request-delivery-fixture";

it("captures only the stable identity and verified Git revision of an eligible Knowledge wikilink", async () => {
  const f = await deliveryFixture();
  const { run, seed, record } = f;
  try {
    const ids = [
      "knowledge-33333333-3333-4333-8333-000000000484",
      "knowledge-33333333-3333-4333-8333-000000000485",
      "knowledge-33333333-3333-4333-8333-000000000486",
    ] as const;
    const cases = [
      [ids[0], "ACT-01", "approved"],
      [ids[1], "ACT-02", "draft"],
      [ids[2], "ACT-03", "approved"],
    ] as const;
    const body = "Private actor notes outside the requested attachment set.";
    await Promise.all(
      cases.map(([id, display_id, approval]) =>
        seed(
          `${f.p.folder}/${display_id}.md`,
          {
            schema: "product-engineering.knowledge/v1",
            id,
            project_id: project,
            kind: "actor",
            display_id,
            title: display_id,
            approval,
            actor_type: "human",
          },
          body,
        ),
      ),
    );
    f.dirty.add(`${f.p.folder}/ACT-03.md`);
    const source = await run(f.store.readContent(f.prdPath));
    await seed(
      f.prdPath,
      source.frontmatter,
      source.body + "\n[[ACT-01#Goal|Actor]] [[ACT-02]] [[ACT-03]].\n",
    );
    await run(confirmRequestReady(await record(), manual, 3, true));
    const draft = await record();
    const preview = await run(readRequestPackagePreview(draft));
    await run(releaseFeatureRequest(draft, preview.basis));
    const frozen = await run(readFeatureRequestRevision(project, request, 1));
    const cited = frozen?.package?.package.links?.filter(
      ({ source: sourceId }) => sourceId === prd,
    );
    expect(cited).toEqual([
      {
        source: prd,
        target: "ACT-01",
        anchor: "Goal",
        alias: "Actor",
        artifact: { id: ids[0], commit: sha },
      },
      { source: prd, target: "ACT-02" },
      { source: prd, target: "ACT-03" },
    ]);
    expect(frozen?.exportJson).not.toContain(body);
  } finally {
    await f.host.runtime.dispose();
  }
});

it("guards approval, saves explicit confirmations, freezes attributable inputs and verifies exported bytes", async () => {
  const f = await deliveryFixture();
  const { record, run, host } = f;
  try {
    let current = await record();
    await expect(run(releaseFeatureRequest(current, "unreviewed"))).rejects.toMatchObject({
      reason: "readiness",
    });
    await expect(run(confirmRequestReady(current, manual, 2, true))).rejects.toMatchObject({
      reason: "readiness",
    });
    await run(confirmRequestReady(current, manual, 3, true));
    await run(confirmRequestReady(current, manual, 3, true));
    current = await record();
    expect(current.manualChecks).toEqual({ version: 3, ids: [manual] });
    const old = await run(readRequestPackagePreview(current));
    expect(old.ready).toBe(true);
    await run(editRequestScope(current, "Only cases approved on Monday"));
    await expect(
      run(editRequestScope(current, "Overwrite with an older edit")),
    ).rejects.toMatchObject({ reason: "conflict" });
    current = await record();
    expect(current.manualChecks).toBeUndefined();
    await run(confirmRequestReady(current, manual, 3, true));
    current = await record();
    f.dirty.add(f.prdPath);
    await expect(run(releaseFeatureRequest(current, old.basis))).rejects.toMatchObject({
      reason: "readiness",
    });
    f.dirty.clear();
    await expect(run(releaseFeatureRequest(current, old.basis))).rejects.toMatchObject({
      reason: "stale",
    });
    const preview = await run(readRequestPackagePreview(current));
    const competing = await Promise.allSettled([
      run(releaseFeatureRequest(current, preview.basis)),
      run(releaseFeatureRequest(current, preview.basis)),
    ]);
    expect(competing.map(({ status }) => status).toSorted()).toEqual(["fulfilled", "rejected"]);
    const revision = await run(readFeatureRequestRevision(project, request, 1));
    if (!revision?.exportJson || !revision.package)
      throw new Error("Expected an immutable release");
    expect(revision.package.package).toMatchObject({
      scope: "Only cases approved on Monday",
      nfrs: [],
      domain: { entities: [], edges: [], neighbors: [] },
      useCase: { commit: sha, criteria: [criterion] },
      requirement: { anchor: "REQ-03", artifactId: prd, commit: sha },
      links: [
        {
          source: pbiId,
          target: "PRD-03",
          anchor: "REQ-03",
          alias: "Requirement",
          artifact: { id: prd, commit: sha },
        },
      ],
    });
    expect(revision.package.package.gherkin).toContain("@UC-09 @AC-09 @SC-09");
    const { package: data, checksum } = revision.package;
    expect(checksum).toMatchObject({
      algorithm: "SHA-256",
      serialization: "sorted-json-utf8-v1",
      value: createHash("sha256").update(canonicalRequestJson(data)).digest("hex"),
    });
    expect(revision.exportJson).toBe(canonicalRequestJson(revision.package));
    expect(await run(verifyRequestPackage(revision.package))).toBe(checksum?.value);
    await expect(
      run(
        verifyRequestPackage({
          package: { ...data, scope: "An altered scope" },
          ...(checksum && { checksum }),
        }),
      ),
    ).rejects.toMatchObject({ reason: "evidence" });
    expect(await run(readFeatureRequestRevision(project, request, 2))).toBeUndefined();
  } finally {
    await host.runtime.dispose();
  }
});

it("correlates durable fixture events and evidence to a frozen revision and attempt", async () => {
  const f = await deliveryFixture();
  const { record, run, host } = f;
  try {
    const draft = await record();
    await run(confirmRequestReady(draft, manual, 3, true));
    const checked = await record();
    await run(
      releaseFeatureRequest(checked, (await run(readRequestPackagePreview(checked))).basis),
    );
    const released = await record();
    expect(
      pbiBoardStage(
        { state: "Open", fields: {} },
        featureRequestsForPbi(project, pbiId, [released]),
      ),
    ).toBe("Open");
    f.dirty.add(f.prdPath);
    await expect(run(dispatchFeatureRequest(released))).rejects.toMatchObject({ reason: "stale" });
    f.dirty.clear();
    await run(
      f.store.update(f.p.notePath, () => Result.succeed({ set: { data_class: "confidential" } })),
    );
    await expect(run(dispatchFeatureRequest(released))).rejects.toMatchObject({ reason: "stale" });
    await run(
      f.store.update(f.p.notePath, () => Result.succeed({ set: { data_class: "internal" } })),
    );
    const [ack, repeated] = await Promise.all([
      run(dispatchFeatureRequest(released)),
      run(dispatchFeatureRequest(released)),
    ]);
    expect(ack).toEqual(repeated);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    const A = await run(readFeatureRequestRevision(project, request, 1));
    if (!A?.package) throw new Error("Expected frozen package A");
    const pickup = await run(f.delivery.fixtureEvent(ack, A.package.package, "pickup", 1));
    expect(
      await Promise.all([run(recordFactoryEvent(pickup)), run(recordFactoryEvent(pickup))]),
    ).toEqual(["recorded", "duplicate"]);
    const wrong = { ...pickup, checksum: "c".repeat(64) };
    expect(await run(recordFactoryEvent(wrong))).toBe("ignored");
    let current = await record();
    expect(
      pbiBoardStage(
        { state: "Open", fields: {} },
        featureRequestsForPbi(project, pbiId, [current]),
      ),
    ).toBe("In Development");
    await run(simulateFactoryEvent(current, "question"));
    current = await record();
    const question = (await run(readFeatureRequestRevision(project, request, 1)))?.events.at(-1);
    if (question?.kind !== "question") throw new Error("A worker question is missing");
    expect(question.scope).toBe(scope);
    await expect(
      run(replyToFactory(current, "old-question", "Confirm scope", false)),
    ).rejects.toMatchObject({ reason: "delivery" });
    await run(replyToFactory(current, question.id, "Confirmed", false));
    await run(simulateFactoryEvent(await record(), "fail"));
    current = await record();
    const retried = await Promise.all([
      run(retryFeatureRequest(current)),
      run(retryFeatureRequest(current)),
    ]);
    expect(retried[0]).toMatchObject({ attempt: 2, runId: ack.runId });
    expect(retried[1]).toEqual(retried[0]);
    expect(f.retry).toHaveBeenCalledTimes(1);
    expect(await run(dispatchFeatureRequest(released))).toEqual(ack);
    expect(await run(recordFactoryEvent(pickup))).toBe("ignored");
    await run(simulateFactoryEvent(await record(), "pickup"));
    const technical = await run(
      f.delivery.fixtureEvent(retried[0], A.package.package, "verify", 6),
    );
    if (technical.kind !== "verified") throw new Error("Missing verifiable fixture evidence");
    await expect(
      run(recordFactoryEvent({ ...technical, result: { ...technical.result, evidence: [] } })),
    ).rejects.toMatchObject({ reason: "evidence" });
    expect(await run(recordFactoryEvent(technical))).toBe("recorded");
    expect(await run(recordFactoryEvent(technical))).toBe("duplicate");
    current = await record();
    expect(current.state).toBe("review");
    const reviewed = await run(readFeatureRequestRevision(project, request, 1));
    expect(reviewed?.technical).toEqual(technical);
    expect(reviewed?.decision).toBeUndefined();
    expect(reviewed?.doneGates).toMatchObject([
      { id: "base-done", status: "passed" },
      { id: "base-review", status: "open" },
    ]);
    await run(prepareRequestFollowup(current));
    await expect(run(prepareRequestFollowup(current))).rejects.toMatchObject({
      reason: "conflict",
    });
    expect(await run(recordFactoryEvent(technical))).toBe("ignored");
    const B = await record();
    expect(B).toMatchObject({ id: request, state: "draft", revision: 2 });
    expect(B.runId).toBeUndefined();
    expect(
      pbiBoardStage({ state: "Open", fields: {} }, featureRequestsForPbi(project, pbiId, [B])),
    ).toBe("In Development");
    expect(
      pbiBoardStage(
        { state: "Done", fields: { pbi_stage_choice: "Done" } },
        featureRequestsForPbi(project, pbiId, [B]),
      ),
    ).toBe("Done");
    expect(await run(readFeatureRequestRevision(project, request, 1))).toMatchObject({
      isCurrent: false,
      exportJson: A.exportJson,
      technical,
    });
  } finally {
    await host.runtime.dispose();
  }
});

it("turns a scoped clarification into a fresh draft while retaining the first run journal", async () => {
  const f = await deliveryFixture();
  const { record, run, host } = f;
  try {
    const draft = await record();
    await run(confirmRequestReady(draft, manual, 3, true));
    const checked = await record();
    await run(
      releaseFeatureRequest(checked, (await run(readRequestPackagePreview(checked))).basis),
    );
    const ready = await record();
    await run(dispatchFeatureRequest(ready));
    await run(simulateFactoryEvent(await record(), "pickup"));
    await run(simulateFactoryEvent(await record(), "question"));
    const waiting = await record();
    await expect(run(prepareRequestFollowup(waiting))).rejects.toMatchObject({
      reason: "delivery",
    });
    const old = await run(readFeatureRequestRevision(project, request, 1));
    const question = old?.events.at(-1);
    if (question?.kind !== "question") throw new Error("Missing answerable worker question");
    await expect(run(replyToFactory(waiting, question.id, scope, true))).rejects.toMatchObject({
      reason: "scope",
    });
    await run(replyToFactory(waiting, question.id, "Include every approved case", true));
    const changed = await record();
    expect(changed.state).toBe("changes-requested");
    await run(prepareRequestFollowup(changed));
    const current = await record();
    expect(current).toMatchObject({
      id: request,
      revision: 2,
      state: "draft",
      scope: "Include every approved case",
    });
    expect(current.manualChecks).toBeUndefined();
    const frozen = await run(readFeatureRequestRevision(project, request, 1));
    expect(frozen).toMatchObject({
      state: "changes-requested",
      scope,
      exportJson: old?.exportJson,
    });
    expect(frozen?.events.at(-1)).toMatchObject({
      kind: "scope-change",
      questionId: question.id,
      reply: "Include every approved case",
    });
  } finally {
    await host.runtime.dispose();
  }
});
