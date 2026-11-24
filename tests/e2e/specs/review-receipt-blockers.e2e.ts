import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { canonicalRequestJson, reviewsRoute } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import { deliveryPath, deliveryRequest } from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

async function changeReceipt(
  change: "sha" | "technical" | "foreign" | "restore",
  original: string,
) {
  await browser.executeObsidian(
    async ({ app }, fixture) => {
      const note = app.vault.getFileByPath(fixture.path);
      if (!note) throw new Error("Missing review request");
      await app.fileManager.processFrontMatter(note, (fields: Record<string, unknown>) => {
        const data = JSON.parse(fixture.original) as {
          current: { events: { projectId?: string; result: Record<string, unknown> }[] };
        };
        const event = data.current.events[0];
        if (!event) throw new Error("Missing original receipt");
        if (fixture.change === "sha") delete event.result.commit;
        if (fixture.change === "technical") delete event.result.technicalReview;
        if (fixture.change === "foreign")
          event.projectId = "project-33333333-3333-4333-8333-000000000102";
        fields.delivery_data = JSON.stringify(data);
      });
    },
    { path: deliveryPath, change, original },
  );
}

it("V20: selected revisions name missing SHA, absent technical approval and foreign evidence without writing", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault();
  const original = (await readReviewFixture()).value;
  await changeReceipt("sha", original);
  const noSha = await readVaultText(deliveryPath);
  await setViewRoute(reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 }));
  await expect(el("review-blocker")).toHaveText("Der Prüf-Commit für diesen Versuch fehlt.");
  await expect(el("review-criterion-check")).toBeDisabled();
  await expect(el("review-accept")).toBeDisabled();
  await browser.execute((button: HTMLElement) => button.click(), await el("review-accept"));
  expect(await readVaultText(deliveryPath)).toBe(noSha);

  await changeReceipt("technical", original);
  await expect(el("review-blocker")).toHaveText(
    "Die technische Freigabe für diesen Prüf-Commit fehlt.",
  );
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("review-change")).toBeDisabled();
  await changeReceipt("foreign", original);
  await expect(el("review-blocker")).toHaveText(
    "Der Prüfnachweis gehört zu einem anderen Lauf, Versuch oder Paket.",
  );
  await expect(el("request-evidence")).not.toHaveText(expect.stringContaining(reviewTestedCommit));
  const foreign = await readVaultText(deliveryPath);
  await expect(el("review-criterion-check")).toBeDisabled();

  await setViewRoute(reviewsRoute(customerProject));
  await expect(browser.$(`${ROOT} [data-review-row="FR-024"]`)).not.toExist();
  expect(await readVaultText(deliveryPath)).toBe(foreign);
  expect(canonicalRequestJson(JSON.parse(original))).toBe(original);
});
