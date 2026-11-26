import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { featureRequestsRoute, reviewsRoute } from "../../../src/application/feature-requests";
import { customerFolder, customerProject } from "../knowledge-vault";
import { changeFixtureFile, deliveryRequest, prdChange } from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { ROOT, setViewRoute, VIEW_TYPE } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const selection = { requestId: deliveryRequest, revision: 2 } as const;

it("V20: blocks stale sources and a held decision after the second installed leaf prepares revision 3", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault();
  await setViewRoute(reviewsRoute(customerProject, selection));
  await expect(el("review-change")).toBeEnabled();
  const original = await readReviewFixture();
  await el("review-change").click();
  await expect(browser.$('[role="dialog"] textarea')).toBeFocused();
  await browser
    .$('[role="dialog"] textarea')
    .setValue("Bitte die gefilterten Zeilen eindeutig kennzeichnen.");
  await changeFixtureFile(customerFolder + "/PRD-03.md", "", prdChange);
  await expect(el("review-blocker")).toHaveText(
    "Der Prüf-Commit gehört zu einem früheren Artefaktstand.",
    { wait: 15_000 },
  );
  await expect(el("review-criterion-check")).toBeDisabled();
  await expect(el("review-accept")).toBeDisabled();
  expect((await readReviewFixture()).bytes).toBe(original.bytes);

  await browser.executeObsidian(
    async ({ app }, type, route) => {
      const first = app.workspace.getLeavesOfType(type)[0];
      if (!first) throw new Error("Missing selected Review leaf");
      first.view.containerEl.dataset.testid = "review-first-leaf";
      const second = app.workspace.getLeaf("split", "vertical");
      second.view.containerEl.dataset.testid = "review-second-leaf";
      await second.setViewState({ type, active: false, state: { route } });
      second.view.containerEl.dataset.testid = "review-second-leaf";
    },
    VIEW_TYPE,
    featureRequestsRoute(customerProject, { requestId: deliveryRequest }),
  );
  const second = browser.$('[data-testid="review-second-leaf"]');
  await expect(second.$('[data-testid="request-tab-run"]')).toExist();
  await browser.execute(
    (button: HTMLElement) => button.click(),
    await second.$('[data-testid="request-tab-run"]'),
  );
  const followup = second.$('[data-testid="request-followup"]');
  await expect(followup).toBeEnabled();
  await browser.execute((button: HTMLElement) => button.click(), await followup);
  await expect(second.$('[data-testid="request-detail"]')).toHaveText(
    expect.stringContaining("FR-024 · Revision 3"),
  );
  const newDraft = await readReviewFixture();
  expect(newDraft.state).toBe("draft");
  expect(newDraft.delivery.history).toMatchObject([
    {
      revision: 2,
      exportJson: original.delivery.current.exportJson,
      events: original.delivery.current.events,
    },
  ]);

  await browser.$('[role="dialog"] [data-testid="review-change-submit"]').click();
  await expect(browser.$('[role="dialog"] [role="alert"]')).toBeDisplayed();
  expect((await readReviewFixture()).bytes).toBe(newDraft.bytes);
  await browser.keys("Escape");
  await expect(el("review-blocker")).toHaveText(
    "Diese Revision ist als historischer Nachweis verfügbar.",
  );
  await expect(el("request-evidence")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("review-followup")).not.toExist();
});
