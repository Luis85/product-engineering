import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute, reviewsRoute } from "../../../src/application/feature-requests";
import { adminProject, customerProject } from "../knowledge-vault";
import { deliveryRequest } from "../request-delivery-vault";
import {
  addForeignReviewFixture,
  foreignReviewId,
  markFixtureAccepted,
  reviewTestedCommit,
  seedReviewRegisterVault,
} from "../review-register-vault";
import { ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = () => browser.$(`${ROOT} [data-review-row="FR-024"]`);
const exact = { requestId: deliveryRequest, revision: 2 } as const;

it("V19: resolves restored review links by project and revision and leaves previous evidence in V18 history", async function () {
  this.timeout(90_000);
  await seedReviewRegisterVault();
  await addForeignReviewFixture();
  await setViewRoute(reviewsRoute(adminProject, exact));
  await expect(el("review-status")).toHaveText(
    "Diese Review-Revision ist in diesem Projekt nicht verfügbar.",
  );
  await expect(el("review-return")).toHaveText("Reviews öffnen");
  await expect(el("request-evidence")).not.toExist();
  await el("review-return").click();
  await expect(row()).toHaveText(expect.stringContaining("Admin-Export separat prüfen"));
  await expect(row()).not.toHaveText(expect.stringContaining("Servicefälle"));
  await row().$("button").click();
  await expect(el("request-evidence")).toHaveText(
    expect.stringContaining("Bereich Administration eingrenzen."),
  );
  await setViewRoute(reviewsRoute(customerProject, { requestId: foreignReviewId, revision: 2 }));
  await expect(el("review-status")).toHaveText(
    "Diese Review-Revision ist in diesem Projekt nicht verfügbar.",
  );
  await setViewRoute(reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 99 }));
  await expect(el("review-status")).toHaveText(
    "Diese Review-Revision ist in diesem Projekt nicht verfügbar.",
  );

  const request = featureRequestsRoute(customerProject, { requestId: deliveryRequest });
  await markFixtureAccepted();
  await setViewRoute(request);
  await expect(el("request-state")).toHaveText("Abgenommen");
  await el("request-tab-run").click();
  await el("request-followup").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 3"));
  await setViewRoute(reviewsRoute(customerProject));
  await expect(row()).not.toExist();
  await expect(el("review-status")).toHaveText(
    "Sobald ein Feature Request einen Prüf-Commit hat, erscheint er hier zur fachlichen Abnahme.",
  );
  await setViewRoute(request);
  await el("request-history").$("summary").click();
  await el("request-history").$('[data-history-revision="2"]').click();
  await el("request-tab-evidence").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("request-evidence")).toHaveText(
    expect.stringContaining("Exportumfang fachlich geprüft."),
  );
  await setViewRoute(reviewsRoute(customerProject, exact));
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
});
