import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { customerProject } from "../knowledge-vault";
import {
  addReviewWork,
  currentTask,
  releasedBug,
  releasedIssue,
  removeReviewWork,
  scopeRules,
  seedRichReviewDecision,
  setReviewWorkDone,
  unrelatedTask,
} from "../review-decision-vault";
import {
  changeFixtureFile,
  deliveryRequest,
  entityBefore,
  entityPath,
  nfrAfter,
  nfrBefore,
  nfrPath,
} from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const gate = (id: string) => browser.$(`${ROOT} [data-review-gate="${id}"]`);

it("V20: Done uses released and currently linked work with typed and missing-item blockers", async function () {
  this.timeout(120_000);
  await seedRichReviewDecision();
  await removeReviewWork(releasedBug.id);
  await addReviewWork(currentTask);
  await setViewRoute(reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 }));
  await expect(el("review-criterion-check")).toBeEnabled();
  await expect(gate(scopeRules.bugs.id)).toHaveText(expect.stringContaining(releasedBug.id));
  await expect(gate(scopeRules.bugs.id)).toHaveText(expect.stringContaining("fehlt"));
  await expect(gate(scopeRules.tasks.id)).toHaveText(expect.stringContaining(currentTask.id));
  await expect(gate(scopeRules.issues.id)).toHaveText(expect.stringContaining(releasedIssue.id));
  await expect(gate(scopeRules.scope.id)).toHaveText(expect.stringContaining("Erfüllt"));
  await expect(el("review-done")).not.toHaveText(expect.stringContaining(unrelatedTask.id));
  await el("review-criterion-check").click();
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt", { wait: 15_000 });
  await el("review-manual-check").click();
  await expect(el("review-manual-check")).toBeChecked({ wait: 15_000 });
  await expect(el("review-accept")).toBeDisabled();
  await addReviewWork(releasedBug);
  await setReviewWorkDone(currentTask.id);
  await expect(el("review-accept")).toBeEnabled({ wait: 15_000 });
  await expect(el("review-done").$("h2")).toHaveText("Done · 8/8 erfüllt");
  await el("review-accept").click();
  await expect(el("review-saved-decision")).toBeDisplayed({ wait: 15_000 });
  const accepted = await readReviewFixture();
  expect(accepted.delivery.current.decision?.proof).toMatchObject({
    reviewers: ["Mara König"],
    manual: [scopeRules.manual.id],
    work: [
      { id: releasedBug.id, state: "Done" },
      { id: releasedIssue.id, state: "Done" },
      { id: currentTask.id, state: "Done" },
    ],
  });
  await removeReviewWork(releasedBug.id);
  await changeFixtureFile(nfrPath, nfrBefore, nfrAfter);
  await browser.executeObsidian(async ({ app }, path) => {
    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Missing domain fixture");
    await app.fileManager.processFrontMatter(file, (fields: Record<string, unknown>) => {
      fields.domain_archived = true;
    });
  }, entityPath);
  await expect(gate(scopeRules.bugs.id)).toHaveText(
    expect.stringContaining("BUG-93 · CSV-Zeilentrenner · Done"),
  );
  await el("request-nfrs").$("summary").click();
  await el("request-domain").$("summary").click();
  await expect(el("request-nfrs")).toHaveText(expect.stringContaining(nfrBefore));
  await expect(el("request-domain")).toHaveText(expect.stringContaining(entityBefore));
  expect((await readReviewFixture()).bytes).toBe(accepted.bytes);
});
