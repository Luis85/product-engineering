import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { deliveryPath, deliveryRequest } from "../request-delivery-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

it("V20: a passed installed receipt leaves guarded human checks pending for the exact tested revision", async function () {
  this.timeout(90_000);
  await seedReviewRegisterVault();
  const before = await readVaultText(deliveryPath);
  await setViewRoute(reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 }));
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining("Technisch freigegeben"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining("Ausstehend"));
  expect(await readVaultText(deliveryPath)).toBe(before);
  await expect(el("review-accept")).toBeDisplayed();
  await expect(el("review-accept")).toBeDisabled();
  await expect(el("review-criterion-check")).toBeEnabled();
});
