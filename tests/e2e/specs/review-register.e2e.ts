import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { deliveryPath } from "../request-delivery-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { readVaultText, ROOT } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const entry = () => el("project-rail").$("button=Reviews");
const row = (id: string) => browser.$(`${ROOT} [data-review-row="${id}"]`);

it("V19: exposes scoped typed Reviews membership and opens the tested FR-024 revision", async function () {
  this.timeout(90_000);
  await seedReviewRegisterVault(true);
  const before = await readVaultText(deliveryPath);
  await expect(entry()).toBeDisplayed();
  await entry().click();
  await expect(el("review-register")).toBeDisplayed();
  await expect(row("FR-025")).not.toExist();
  await expect(row("FR-023")).toHaveText(expect.stringContaining("Änderung angefragt"));
  await expect(row("FR-023")).toHaveText(expect.stringContaining("Kein erfolgreicher CI-Nachweis"));
  await expect(row("FR-023").$("code")).not.toExist();
  const tested = row("FR-024");
  await expect(tested).toHaveText(expect.stringContaining("CSV-Export · Servicefälle"));
  await expect(tested).toHaveText(expect.stringContaining("FR-024 · RUN-042"));
  await expect(tested.$('[data-testid="review-business"]')).toHaveText(
    expect.stringContaining("In Review"),
  );
  await expect(tested.$('[data-testid="review-technical"]')).toHaveText(
    expect.stringContaining("Freigegeben"),
  );
  await expect(tested).toHaveText(expect.stringContaining("CI bestanden"));
  await expect(tested.$("code")).toHaveText("e3b7c21");
  await expect(tested.$("code")).toHaveAttribute("title", reviewTestedCommit);
  await expect(tested.$('[data-testid="review-stale"]')).not.toExist();
  await tested.$("button").click();
  await expect(el("request-evidence").$("h2")).toHaveText("Nachweise");
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  expect(await readVaultText(deliveryPath)).toBe(before);
});
