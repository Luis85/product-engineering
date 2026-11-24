import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute, reviewsRoute } from "../../../src/application/feature-requests";
import { projectOverviewRoute } from "../../../src/application/projects";
import { deliveryStages } from "../../../src/domain/feature-requests";
import type { DeliveryStage } from "../../../src/domain/feature-requests";
import { customerProject } from "../knowledge-vault";
import {
  clarificationId,
  clarificationTitle,
  finishOverviewOpenWork,
  seedComparisonOverview,
  seedOverviewClarification,
} from "../overview-delivery-vault";
import { deliveryRequest } from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit } from "../review-register-vault";
import { readViewRoute, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const main = () => el("overview-featured");
const mainHeading = () => browser.$(`${ROOT} [data-testid="overview-featured"] h2`);
const action = () => el("overview-featured-action");
const tasks = () => el("overview-tasks");
const metric = (stage: DeliveryStage) =>
  el("overview-stages").$(`[data-overview-stage="${stage}"]`);
const back = () => el("frame-history").$('button[aria-label="Zurück"]');

async function activate(control: WebdriverIO.Element) {
  await browser.execute((element: HTMLElement) => element.focus(), control);
  await browser.keys("Enter");
}

async function drill(stage: DeliveryStage, expected: string[], total: number) {
  const target = metric(stage);
  await expect(target).toBeDisplayed();
  await expect(target.$("strong")).toHaveText(String(expected.length));
  await activate(await target);
  await expect(el("request-filter-count")).toHaveText(`${expected.length} von ${total} Requests`);
  expect(await readViewRoute()).toEqual(featureRequestsRoute(customerProject, { stage }));
  const rows = el("request-register").$$("[data-request-row]");
  await expect(rows).toBeElementsArrayOfSize(expected.length);
  const ids = await browser.execute(
    (register: HTMLElement) =>
      Array.from(
        register.querySelectorAll<HTMLElement>("[data-request-row]"),
        (row) => row.dataset.requestRow,
      ),
    await el("request-register"),
  );
  expect(ids).toEqual(expected);
  if (!expected.length)
    await expect(el("request-empty")).toHaveText(
      "In dieser Lieferphase gibt es keine Feature Requests.",
    );
  await back().click();
  await expect(metric(stage)).toBeFocused();
}

it("J10: leads with exact actionable review, synchronizes all six filters after a real decision, and shows history", async function () {
  this.timeout(145_000);
  await seedComparisonOverview();
  await seedOverviewClarification();
  await setViewRoute(projectOverviewRoute(customerProject));
  await expect(mainHeading()).toBeDisplayed();
  await expect(mainHeading()).toHaveText("Fachliche Abnahme steht an");
  await expect(main()).toHaveText(expect.stringContaining("FR-024 · CSV-Export · Servicefälle"));
  await expect(tasks().$$("li")).toBeElementsArrayOfSize(2);
  await expect(tasks().$("button*=" + clarificationTitle)).toBeDisplayed();
  await expect(tasks()).not.toHaveText(expect.stringContaining("FR-024"));
  await expect(tasks()).not.toHaveText(expect.stringContaining("Nur in der Administration"));
  for (const stage of deliveryStages) {
    await drill(stage, stage === "review" ? ["FR-024"] : stage === "blocked" ? ["FR-025"] : [], 2);
  }
  await activate(await action());
  expect(await readViewRoute()).toEqual(
    reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 }),
  );
  await expect(el("review-criterion-check")).toBeDisplayed({ wait: 20_000 });
  await expect(el("review-criterion-check")).toBeEnabled({ wait: 20_000 });
  await el("review-criterion-check").click();
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt", { wait: 20_000 });
  await expect(el("review-accept")).toBeEnabled();
  await el("review-accept").click();
  await expect(el("review-saved-decision")).toHaveText(
    expect.stringContaining(reviewTestedCommit),
    { wait: 20_000 },
  );
  expect((await readReviewFixture()).delivery.current.decision).toMatchObject({
    decision: "accepted",
    commit: reviewTestedCommit,
    proof: { revision: 2 },
  });

  await back().click();
  await expect(mainHeading()).toHaveText("Ein Request braucht Klärung");
  await expect(main()).toHaveText(expect.stringContaining(clarificationTitle));
  await expect(tasks().$("button*=" + clarificationTitle)).not.toExist();
  await drill("review", [], 2);
  await drill("done", ["FR-024"], 2);
  await activate(await action());
  await expect(el("request-detail").$("h1")).toHaveText(clarificationTitle);
  expect(await readViewRoute()).toMatchObject({
    projectId: customerProject,
    requestId: clarificationId,
    revision: 1,
  });
  await back().click();
  await expect(action()).toBeFocused();

  await finishOverviewOpenWork();
  await expect(mainHeading()).toHaveText("Abnahme dokumentiert");
  await activate(await action());
  await expect(el("request-filter-count")).toHaveText("1 von 1 Requests");
  expect(await readViewRoute()).toEqual(featureRequestsRoute(customerProject, { stage: "done" }));
});
