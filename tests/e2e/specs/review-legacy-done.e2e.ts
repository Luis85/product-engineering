import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import type { StoredRequestPackage } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { deliveryRequest } from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const review = reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 });

it("V20: explains missing released Done definitions and prepares a follow-up without accepting", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault(false, {
    mapRelease: ({ definitions: _rules, ...payload }) => payload,
  });
  await setViewRoute(review);
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining("CI bestanden"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining("Technisch freigegeben"));
  await expect(el("review-criterion-check")).toBeEnabled();
  await el("review-criterion-check").click();
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt", { wait: 15_000 });
  await expect(el("review-done").$("h2")).toHaveText("Done · 2/2 erfüllt");
  await expect(el("review-accept")).toBeDisabled();
  await expect(el("review-change")).toBeEnabled();

  const before = await readReviewFixture();
  const released = JSON.parse(before.delivery.current.exportJson ?? "") as StoredRequestPackage;
  expect(released.checksum?.value).toMatch(/^[\da-f]{64}$/);
  expect(released.package.definitions).toBeUndefined();
  expect(before.delivery.current.decision).toBeUndefined();
  await expect(el("review-done")).toHaveText(
    expect.stringContaining("Die Done-Definitionen fehlen im freigegebenen Paket."),
  );
  await browser.execute((button: HTMLElement) => button.click(), await el("review-accept"));
  expect((await readReviewFixture()).bytes).toBe(before.bytes);

  await expect(el("review-followup")).toBeEnabled();
  await el("review-followup").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 3"), {
    wait: 15_000,
  });
  const after = await readReviewFixture();
  expect(after.state).toBe("draft");
  expect(after.delivery.current.decision).toBeUndefined();
  expect(after.delivery.history).toMatchObject([
    {
      revision: 2,
      exportJson: before.delivery.current.exportJson,
      events: before.delivery.current.events,
    },
  ]);
  expect(after.delivery.history[0]?.decision).toBeUndefined();
});
