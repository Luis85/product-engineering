import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogRoute, pbiDetailRoute } from "../../../src/application/backlog";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { traceRoute } from "../../../src/application/trace";
import { exportPath } from "../backlog-vault";
import { adminFolder, adminProject, customerFolder, customerProject } from "../knowledge-vault";
import {
  deliveryCriterion,
  deliveryPath,
  deliveryRequest,
  changeFixtureFile,
  prdChange,
} from "../request-delivery-vault";
import {
  addForeignReviewFixture,
  markFixtureAccepted,
  reviewTestedCommit,
  seedReviewRegisterVault,
} from "../review-register-vault";
import { readReviewFixture } from "../review-decision-vault";
import { readVaultText, readViewRoute, ROOT, setViewRoute } from "../support";
import { addTraceSources } from "../trace-vault";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const selectedReview = reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 });
const legacy = adminFolder + "/Admin service.md";

function patchPbi(path: string, fields: Record<string, unknown>) {
  return browser.executeObsidian(
    async ({ app }, filePath, values) => {
      const pbi = app.vault.getFileByPath(filePath);
      if (!pbi) throw new Error("Missing fixture PBI to update");
      await app.fileManager.processFrontMatter(pbi, (stored: Record<string, unknown>) => {
        Object.assign(stored, values);
      });
    },
    path,
    fields,
  );
}

it("V21: keeps a stale accepted revision readable, isolates draft criteria, and handles foreign, legacy and empty projects", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault(false, {
    options: { requirement: "REQ-18" },
    async beforeRelease(git) {
      await addTraceSources();
      git("add", "--", "PRD-03.md");
      git("commit", "--quiet", "-m", "Trace source proof");
    },
  });
  await markFixtureAccepted();
  await addForeignReviewFixture();
  await setViewRoute(traceRoute(customerProject));
  await expect(el("trace-delivery")).toBeDisplayed();
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining("Fachlich abgenommen"));
  await changeFixtureFile(customerFolder + "/PRD-03.md", "", prdChange);
  await expect(el("trace-stale")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining(reviewTestedCommit));

  await el("trace-review").click();
  expect(await readViewRoute()).toEqual(selectedReview);
  await expect(el("review-followup")).toBeDisplayed();
  await expect(el("review-followup")).toBeEnabled();
  await el("review-followup").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("Revision 3"));
  expect((await readReviewFixture()).delivery.history).toMatchObject([
    { revision: 2, decision: { decision: "accepted", commit: reviewTestedCommit } },
  ]);
  await patchPbi(exportPath, {
    pbi_criteria: [
      {
        ...deliveryCriterion,
        scenario_id: "SC-99",
        text: "Neuer Filter für einen späteren Export",
      },
    ],
  });
  const requestBytes = await readVaultText(deliveryPath);
  const pbiBytes = await readVaultText(exportPath);
  await setViewRoute(traceRoute(customerProject));
  await expect(el("trace-delivery")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining("Revision 3"));
  await expect(el("trace-earlier")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-earlier")).toHaveText(
    expect.stringContaining("Früherer Nachweis · FR-024 · Revision 2"),
  );
  await expect(el("trace-earlier")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("trace-earlier")).toHaveText(expect.stringContaining("AC-09 · SC-09"));
  await expect(el("trace-earlier")).toHaveText(expect.stringContaining("ci-42"));
  await expect(el("trace-criteria")).toHaveText(expect.stringContaining("AC-09 · SC-99"));
  await expect(el("trace-criteria")).not.toHaveText(expect.stringContaining("ci-42"));
  await expect(el("trace-delivery")).toHaveText(expect.stringContaining("Prüf-Commit ausstehend"));
  await expect(el("trace-delivery")).not.toHaveText(expect.stringContaining(reviewTestedCommit));
  await el("trace-earlier-review").click();
  expect(await readViewRoute()).toEqual(selectedReview);
  await el("frame-history").$("button:first-child").click();
  await expect(el("trace-earlier-review")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-earlier-review")).toBeFocused();
  await el("trace-pbi").selectByAttribute("value", "UC-12");
  await expect(el("trace-gap")).toBeDisplayed();
  await expect(el("trace-gap")).toHaveText(expect.stringContaining("Research-Fundstelle fehlt"));
  await expect(el("trace-source")).toHaveText(expect.stringContaining("PRD-Anforderung fehlt"));
  await expect(el("trace-earlier")).not.toExist();
  await el("trace-gap-pbi").click();
  expect(await readViewRoute()).toEqual(pbiDetailRoute(customerProject, "UC-12"));
  await el("frame-history").$("button:first-child").click();
  await expect(el("trace-gap-pbi")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-gap-pbi")).toBeFocused();
  await expect(el("trace-pbi")).toHaveValue("UC-12");

  await setViewRoute(traceRoute(adminProject));
  await expect(el("trace-gap")).toBeDisplayed();
  await expect(el("trace-gap")).toHaveText(expect.stringContaining("eindeutige ID"));
  await expect(el("trace-delivery")).not.toHaveText(expect.stringContaining("FR-024"));
  await patchPbi(legacy, {
    schema: "product-engineering.backlog/v1",
    id: "backlog-33333333-3333-4333-8333-000000009090",
  });
  await expect(el("trace-reason")).toBeDisplayed({ wait: 20_000 });
  await expect(el("trace-reason")).toHaveText("Bereich Administration eingrenzen.", {
    wait: 20_000,
  });
  await expect(el("trace-delivery")).not.toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("trace-source")).not.toHaveText(expect.stringContaining("SM-01:CARD-03"));
  await expect(el("trace-earlier")).not.toExist();
  await browser.executeObsidian(async ({ app }, path) => {
    const note = app.vault.getFileByPath(path);
    if (!note) throw new Error("Missing foreign fixture PBI");
    await app.vault.delete(note);
  }, legacy);
  await expect(el("trace-pbi")).not.toExist();
  await expect(el("trace-empty-backlog")).toBeDisplayed();
  await el("trace-empty-backlog").click();
  expect(await readViewRoute()).toEqual(backlogRoute(adminProject));
  expect(await readVaultText(deliveryPath)).toBe(requestBytes);
  expect(await readVaultText(exportPath)).toBe(pbiBytes);
});
