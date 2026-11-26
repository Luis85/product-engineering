import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { backlogBoardRoute } from "../../../src/application/backlog";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { exportPath } from "../backlog-vault";
import { customerFolder, customerProject } from "../knowledge-vault";
import { pbiDeclaration } from "../pbi-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const row = () => browser.$(`${ROOT} [data-review-row="FR-024"] button`);

function pbiGitState() {
  const cwd = join(browser.getObsidianPage().getVaultPath(), customerFolder);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, windowsHide: true }).toString().trim();
  return {
    branch: git("rev-parse", "HEAD"),
    branchPbi: git("rev-parse", "HEAD:" + pbiDeclaration),
    diskPbi: git("hash-object", pbiDeclaration),
  };
}

it("V20: accepts exactly one decision, returns to the register, and preserves Board and PBI bytes after restart", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault();
  const initial = await readReviewFixture();
  const pbiBefore = await readVaultText(exportPath);
  const gitBefore = pbiGitState();
  expect(gitBefore.branchPbi).toBe(gitBefore.diskPbi);
  await setViewRoute(reviewsRoute(customerProject));
  await row().click();
  await expect(el("review-accept")).toBeDisabled();
  await expect(el("review-confirmed")).toHaveText("0 von 1 bestätigt");
  await el("review-criterion-check").click();
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt", { wait: 15_000 });
  await expect(el("review-accept")).toBeEnabled();
  await el("review-accept").click();
  await browser.waitUntil(
    async () => {
      const text = await el("review-done").getText();
      if (await el("review-saved-decision").isExisting()) return true;
      if (await el("review-done").$('[role="alert"]').isExisting()) throw new Error(text);
      return false;
    },
    { timeout: 15_000, timeoutMsg: "The review did not persist an acceptance decision" },
  );
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining("Abgenommen"));
  await expect(el("review-criterion-check")).toBeDisabled();
  const accepted = await readReviewFixture();
  expect(accepted.delivery.history).toEqual([]);
  expect(accepted.delivery.current.events).toEqual(initial.delivery.current.events);
  expect(accepted.delivery.current.exportJson).toBe(initial.delivery.current.exportJson);
  expect(accepted.delivery.current.decision).toMatchObject({
    decision: "accepted",
    commit: reviewTestedCommit,
    proof: { revision: 2, criteria: ["AC-09"] },
  });
  expect(await readVaultText(exportPath)).toBe(pbiBefore);

  await el("review-return").click();
  await expect(row()).toBeFocused();
  await expect(browser.$(`${ROOT} [data-testid="review-business"]`)).toHaveText(
    expect.stringContaining("Abgenommen"),
  );
  await browser.reloadObsidian();
  await openView();
  await row().click();
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(reviewTestedCommit));
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt");
  await expect(el("review-done").$("h2")).toHaveText("Done · 2/2 erfüllt");
  expect((await readReviewFixture()).bytes).toBe(accepted.bytes);
  await setViewRoute(backlogBoardRoute(customerProject));
  await expect(
    browser.$(`${ROOT} [data-board-stage="In Development"] [data-board-card="UC-09"]`),
  ).toBeDisplayed();
  expect(await readVaultText(exportPath)).toBe(pbiBefore);
  expect(pbiGitState()).toEqual(gitBefore);
});
import { execFileSync } from "node:child_process";
import { join } from "node:path";
