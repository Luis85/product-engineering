import { createHash } from "node:crypto";
import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import {
  canonicalRequestJson,
  featureRequestsRoute,
  reviewsRoute,
} from "../../../src/application/feature-requests";
import { storyMapsRoute } from "../../../src/application/story-maps";
import { traceRoute } from "../../../src/application/trace";
import { exportPath } from "../backlog-vault";
import { customerProject } from "../knowledge-vault";
import { capturePrototypeDownload as captureDownload } from "../prototype-native";
import {
  deliveryPath,
  deliveryRequest,
  deliveryScope,
  seedRequestDeliveryVault,
} from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { customerMapId } from "../story-maps-vault";
import { openView, readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";
import { addTraceSources } from "../trace-vault";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const state = (value: string) => expect(el("request-state")).toHaveText(value, { wait: 20_000 });
const requestRoute = featureRequestsRoute(customerProject, {
  requestId: deliveryRequest,
  tab: "gates",
});
const reviewRoute = (revision: number) =>
  reviewsRoute(customerProject, { requestId: deliveryRequest, revision });
const updateReason = "Im Dateinamen muss der gültige Zeitfilter erkennbar sein.";

async function release() {
  await expect(el("request-release")).toBeDisplayed();
  const confirm = el("request-confirm-ready");
  if (!(await confirm.isSelected())) await confirm.click();
  await expect(el("request-release")).toBeEnabled({ wait: 20_000 });
  await el("request-release").click();
  await state("Freigegeben");
  await el("request-tab-run").click();
  await expect(el("request-dispatch")).toBeEnabled({ wait: 20_000 });
  await el("request-dispatch").click();
  await state("Warteschlange");
  await el("request-fixture-pickup").click();
  await state("Läuft");
}

async function verifiedFixture() {
  await el("request-fixture-verify").click();
  await state("In Review");
  const fixture = await readReviewFixture();
  const run = fixture.delivery.current.run;
  const event = fixture.delivery.current.events.findLast(({ kind }) => kind === "verified");
  if (!run || event?.kind !== "verified") throw new Error("The local run has no verified receipt");
  const digest = createHash("sha256")
    .update(`fixture:${run.projectId}:${run.runId}:${run.attempt}:${run.checksum}`)
    .digest("hex");
  expect(event.result.commit).toBe(digest);
  expect(event.result.evidence[0]).toMatchObject({
    commit: digest,
    criterionId: "AC-09",
    scenarioId: "SC-09",
    outcome: "passed",
  });
  return { fixture, event, run, digest };
}

async function writeDeliveryData(value: string) {
  await browser.executeObsidian(
    async ({ app }, path, data) => {
      const file = app.vault.getFileByPath(path);
      if (!file) throw new Error("Missing receipt fixture");
      await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
        fields.delivery_data = data;
      });
    },
    deliveryPath,
    value,
  );
}

it("J09: reviews actual scoped clarification, retry, mismatched CI, change and follow-up acceptance through exact Trace records", async function () {
  this.timeout(150_000);
  const { git } = await seedRequestDeliveryVault(true, true, { requirement: "REQ-18" });
  await addTraceSources();
  git("add", "--", "PRD-03.md");
  git("commit", "--quiet", "-m", "Commit the linked Trace requirement");
  const sourceCommit = git("rev-parse", "HEAD");
  const pbi = await readVaultText(exportPath);
  await openView();
  await setViewRoute(requestRoute);
  await release();
  const runId = await el("request-attempt").$("code").getText();
  await el("request-fixture-question").click();
  await state("Rückfrage");
  const clarification = el("request-clarification");
  await expect(clarification.$("blockquote")).toHaveText(deliveryScope);
  await clarification.$("textarea").setValue("Der Filter begrenzt den Teilumfang wie angegeben.");
  await el("request-answer").click();
  await state("Läuft");
  await el("request-fixture-fail").click();
  await state("Fehlgeschlagen");
  await el("request-retry").click();
  await state("Warteschlange");
  await expect(el("request-attempt")).toHaveText(expect.stringContaining("Versuch 2"));
  await expect(el("request-attempt").$("code")).toHaveText(runId);
  await el("request-fixture-pickup").click();
  await state("Läuft");
  const earlier = await verifiedFixture();
  expect(earlier.run).toMatchObject({ runId, attempt: 2, revision: 2 });
  expect(
    earlier.fixture.delivery.current.events.find(({ kind }) => kind === "question"),
  ).toMatchObject({ scope: deliveryScope, attempt: 1 });
  const mismatch = {
    ...earlier.event,
    result: {
      ...earlier.event.result,
      evidence: earlier.event.result.evidence.map((check) => ({
        ...check,
        commit: "f".repeat(64),
      })),
    },
  };
  const current = earlier.fixture.delivery.current;
  await writeDeliveryData(
    canonicalRequestJson({
      current: {
        ...current,
        events: current.events.map((event) => (event === earlier.event ? mismatch : event)),
      },
      history: [],
    }),
  );
  const mismatchedBytes = await readVaultText(deliveryPath);
  await setViewRoute(reviewRoute(2));
  await expect(el("review-blocker")).toBeDisplayed({ wait: 20_000 });
  await expect(el("review-blocker")).toHaveText(
    "Für den Prüf-Commit fehlen bestandene CI-Nachweise oder ein Pull Request.",
  );
  await expect(el("review-accept")).toBeDisabled();
  await browser.execute((button: HTMLElement) => button.click(), await el("review-accept"));
  expect(await readVaultText(deliveryPath)).toBe(mismatchedBytes);
  expect((await readReviewFixture()).delivery.current.decision).toBeUndefined();

  await writeDeliveryData(earlier.fixture.value);
  await expect(el("review-change")).toBeEnabled({ wait: 20_000 });
  await el("review-change").click();
  await browser.$('[role="dialog"] textarea').setValue(updateReason);
  await el("review-change-submit").click();
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(updateReason), {
    wait: 20_000,
  });
  const changed = await readReviewFixture();
  expect(changed.delivery.current.decision).toMatchObject({
    decision: "changes-requested",
    commit: earlier.digest,
    explanation: updateReason,
    proof: { revision: 2, attempt: 2 },
  });
  await setViewRoute(traceRoute(customerProject));
  await expect(el("trace-reason")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-reason")).toHaveText(updateReason, { wait: 20_000 });
  await el("trace-review").click();
  await expect(el("review-followup")).toBeDisplayed();
  await el("review-followup").click();
  await state("Entwurf");
  await el("request-history").$("summary").click();
  await el("request-history").$('[data-history-revision="2"]').click();
  const historic = await captureDownload(await el("request-export"));
  expect(historic.name).toBe("FR-024-rev-2.json");
  expect(historic.text).toBe(earlier.fixture.delivery.current.exportJson);
  expect(JSON.parse(historic.text)).toMatchObject({
    package: { request: { revision: 2 }, scope: deliveryScope },
  });
  await el("request-current-revision").click();
  await el("request-toggle-gates").click();
  await release();
  const final = await verifiedFixture();
  expect(final.run).toMatchObject({ revision: 3, attempt: 1 });
  expect(final.digest).not.toBe(earlier.digest);
  await setViewRoute(reviewRoute(3));
  await expect(el("review-accept")).toBeDisabled();
  await el("review-criterion-check").click();
  await expect(el("review-accept")).toBeEnabled({ wait: 20_000 });
  await el("review-accept").click();
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(final.digest), {
    wait: 20_000,
  });
  const accepted = await readReviewFixture();
  expect(accepted.delivery.current.decision).toMatchObject({
    decision: "accepted",
    commit: final.digest,
    proof: { revision: 3 },
  });
  expect(accepted.delivery.history).toMatchObject([
    { revision: 2, decision: changed.delivery.current.decision, exportJson: historic.text },
  ]);
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(
    browser.$(`${ROOT} [data-board-stage="In Development"] [data-board-card="UC-09"]`),
  ).toBeDisplayed();
  expect(await readVaultText(exportPath)).toBe(pbi);
  expect(git("rev-parse", "HEAD")).toBe(sourceCommit);

  await setViewRoute(traceRoute(customerProject));
  await browser.reloadObsidian();
  await openView();
  await expect(el("trace-delivery")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining("Fachlich abgenommen"), {
    wait: 20_000,
  });
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining(final.digest));
  await expect(el("trace-source")).toHaveText(expect.stringContaining("PRD-03#REQ-18"));
  await expect(el("trace-source")).toHaveText(expect.stringContaining(sourceCommit));
  await expect(el("trace-source")).toHaveText(expect.stringContaining("RES-02"));
  await el("trace-source").$("[data-trace-card=CARD-03]").click();
  expect(await readViewRoute()).toEqual(storyMapsRoute(customerProject, customerMapId, "CARD-03"));
  await el("frame-history").$("button:first-child").click();
  await expect(el("trace-pbi")).toBeDisplayed();
  await el("trace-pbi").selectByAttribute("value", "UC-12");
  await expect(el("trace-source").$("[data-trace-card=CARD-04]")).toBeDisplayed();
  await expect(el("trace-source")).not.toHaveText(expect.stringContaining("RES-02"));
  await expect(el("trace-delivery")).not.toHaveText(expect.stringContaining(final.digest));
  expect((await readReviewFixture()).bytes).toBe(accepted.bytes);
  expect(await readVaultText(exportPath)).toBe(pbi);
});
