import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { browser, expect } from "@wdio/globals";
import { canonicalRequestJson, featureRequestsRoute } from "../../src/application/feature-requests";
import type { RequestPackage, StoredRequestPackage } from "../../src/application/feature-requests";
import { newNoteText } from "../../src/domain/notes";
import { adminFolder, adminProject, customerFolder, customerProject } from "./knowledge-vault";
import { deliveryPath, deliveryRequest, seedRequestDeliveryVault } from "./request-delivery-vault";
import { requestFolder } from "./request-vault";
import { openView, ROOT, setViewRoute } from "./support";

export const reviewTestedCommit = "e3b7c2121a41bb92878448446bfb12a6a28afdcb";
export const changesPath = requestFolder + "/FR-023.md";
export const draftPath = requestFolder + "/FR-025.md";
export const foreignReviewId = "feature-request-33333333-3333-4333-8333-000000001024";
const changesId = "feature-request-33333333-3333-4333-8333-000000000023";
const fixtureCommit = [
  "tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904",
  "author Review Fixture <fixture@example.invalid> 1700000000 +0000",
  "committer Review Fixture <fixture@example.invalid> 1700000000 +0000",
  "",
  "Tested export fixture 00cae759",
  "",
].join("\n");

function requestNote(displayId: string, title: string, state: string, deliveryData?: string) {
  const sequence = Number(displayId.slice(3));
  return newNoteText({
    schema: "product-engineering.feature-request/v1",
    id: "feature-request-33333333-3333-4333-8333-" + String(sequence).padStart(12, "0"),
    project_id: customerProject,
    display_id: displayId,
    title,
    pbi_id: "UC-09",
    sequence,
    revision: 1,
    scope: "Gefilterte Servicefälle übergeben.",
    state,
    ...(deliveryData && { delivery_data: deliveryData, run_id: "RUN-041" }),
  });
}

async function fixturePackage(mapRelease?: (payload: RequestPackage) => RequestPackage) {
  const releasedJson = await browser.executeObsidian(({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    const raw: unknown = note && app.metadataCache.getFileCache(note)?.frontmatter?.delivery_data;
    if (typeof raw !== "string") throw new Error("Missing released fixture package");
    return (JSON.parse(raw) as { current: { exportJson: string } }).current.exportJson;
  }, deliveryPath);
  const released = JSON.parse(releasedJson) as StoredRequestPackage;
  if (!released.checksum || !released.package.useCase)
    throw new Error("Incomplete fixture package");
  const payload = mapRelease?.(released.package) ?? released.package;
  const checksum = mapRelease
    ? createHash("sha256").update(canonicalRequestJson(payload)).digest("hex")
    : released.checksum.value;
  const exportJson = mapRelease
    ? canonicalRequestJson({
        package: payload,
        checksum: { ...released.checksum, value: checksum },
      })
    : releasedJson;
  return { useCase: released.package.useCase, checksum, exportJson };
}

export async function seedReviewRegisterVault(
  additionalRecords = false,
  fixture?: {
    options?: Parameters<typeof seedRequestDeliveryVault>[2];
    withScope?: boolean;
    beforeRelease?: (
      git: Awaited<ReturnType<typeof seedRequestDeliveryVault>>["git"],
    ) => Promise<void>;
    mapRelease?: (payload: RequestPackage) => RequestPackage;
  },
) {
  const { git } = await seedRequestDeliveryVault(true, fixture?.withScope, fixture?.options);
  const commitPath = join(
    browser.getObsidianPage().getVaultPath(),
    customerFolder,
    ".git",
    "tested",
  );
  writeFileSync(commitPath, fixtureCommit, "utf8");
  expect(git("hash-object", "-w", "-t", "commit", commitPath)).toBe(reviewTestedCommit);
  expect(git("rev-parse", "--verify", "e3b7c21^{commit}")).toBe(reviewTestedCommit);
  await fixture?.beforeRelease?.(git);

  await openView();
  await setViewRoute(
    featureRequestsRoute(customerProject, { requestId: deliveryRequest, tab: "gates" }),
  );
  const release = browser.$(`${ROOT} [data-testid=request-release]`);
  await expect(release).toBeEnabled({ wait: 15_000 });
  await release.click();
  await expect(browser.$(`${ROOT} [data-testid=request-state]`)).toHaveText("Freigegeben", {
    wait: 15_000,
  });
  const { useCase, checksum, exportJson } = await fixturePackage(fixture?.mapRelease);
  const run = {
    projectId: customerProject,
    requestId: deliveryRequest,
    revision: 2,
    checksum,
    runId: "RUN-042",
    attempt: 1,
    provider: "local-fixture",
  };
  const verified = {
    ...run,
    id: "RUN-042-verified-1",
    kind: "verified",
    result: {
      pullRequest: "47",
      commit: reviewTestedCommit,
      technicalReview: { verdict: "approved", commit: reviewTestedCommit },
      evidence: useCase.criteria.map((criterion, index) => ({
        criterionId: criterion.id,
        scenarioId: criterion.scenario_id,
        commit: reviewTestedCommit,
        checkId: `ci-${42 + index}`,
        outcome: "passed",
      })),
    },
  };
  const changeRun = { ...run, requestId: changesId, revision: 1, runId: "RUN-041" };
  const change = {
    ...changeRun,
    id: "RUN-041-scope-change",
    kind: "scope-change",
    questionId: "RUN-041-question",
    reply: "Organisation im Export klar benennen.",
  };
  await browser.executeObsidian(
    async ({ app }, seed) => {
      const note = app.vault.getFileByPath(seed.path);
      if (!note) throw new Error("Missing review fixture");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        fields.state = "review";
        fields.run_id = "RUN-042";
        fields.dispatch_recorded = true;
        fields.delivery_data = seed.delivery;
      });
      for (const entry of seed.additional) await app.vault.create(entry.path, entry.text);
    },
    {
      path: deliveryPath,
      delivery: canonicalRequestJson({
        current: { exportJson, run, events: [verified] },
        history: [],
      }),
      additional: additionalRecords
        ? [
            { path: draftPath, text: requestNote("FR-025", "Ungeprüfter Entwurf", "draft") },
            {
              path: changesPath,
              text: requestNote(
                "FR-023",
                "Exportumfang klären",
                "changes-requested",
                canonicalRequestJson({
                  current: { run: changeRun, events: [change] },
                  history: [],
                }),
              ),
            },
          ]
        : [],
    },
  );
  return useCase.revision;
}

export async function markFixtureAccepted() {
  await browser.executeObsidian(
    async ({ app }, path, commit) => {
      const note = app.vault.getFileByPath(path);
      if (!note) throw new Error("Missing review fixture");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        const delivery = JSON.parse(String(fields.delivery_data)) as {
          current: { run: { runId: string; attempt: number }; decision?: unknown };
        };
        const { runId, attempt } = delivery.current.run;
        delivery.current.decision = {
          decision: "accepted",
          runId,
          attempt,
          commit,
          explanation: "Exportumfang fachlich geprüft.",
        };
        fields.state = "accepted";
        fields.delivery_data = JSON.stringify(delivery);
      });
    },
    deliveryPath,
    reviewTestedCommit,
  );
}

export async function addForeignReviewFixture() {
  const run = {
    projectId: adminProject,
    requestId: foreignReviewId,
    revision: 2,
    checksum: "a".repeat(64),
    runId: "RUN-901",
    attempt: 1,
    provider: "local-fixture",
  };
  const event = {
    ...run,
    id: "foreign-scope-change",
    kind: "scope-change",
    reply: "Bereich Administration eingrenzen.",
    questionId: "foreign-question",
  };
  await browser.executeObsidian(
    async ({ app }, path, text) => {
      await app.vault.create(path, text);
    },
    adminFolder + "/FR-024.md",
    newNoteText({
      schema: "product-engineering.feature-request/v1",
      id: foreignReviewId,
      project_id: adminProject,
      display_id: "FR-024",
      title: "Admin-Export separat prüfen",
      pbi_id: "UC-09",
      sequence: 24,
      revision: 2,
      scope: "Nur Konten aus der Admin Console exportieren.",
      state: "changes-requested",
      run_id: run.runId,
      delivery_data: canonicalRequestJson({ current: { run, events: [event] }, history: [] }),
    }),
  );
}
import { createHash } from "node:crypto";
