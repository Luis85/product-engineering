import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { deliveryPath, deliveryRequest } from "../request-delivery-vault";
import { readReviewFixture } from "../review-decision-vault";
import { reviewTestedCommit, seedReviewRegisterVault } from "../review-register-vault";
import { openView, readVaultText, ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);
const dialog = () => browser.$('[role="dialog"]');
const reason = () => dialog().$("textarea");
const selection = { requestId: deliveryRequest, revision: 2 } as const;
const explanation =
  "Filterzustand im Dateinamen ergänzen. Erwartet wird ein reproduzierbarer Export.";

async function press(element: WebdriverIO.Element) {
  await expect(element).toBeDisplayed();
  await browser.execute((node: HTMLElement) => node.focus(), element);
  await browser.keys("Enter");
}

it("V20: reviews Gherkin and requests changes by keyboard at 390 px, preserving the reason through refusal and reload", async function () {
  this.timeout(120_000);
  await seedReviewRegisterVault();
  await setViewRoute(reviewsRoute(customerProject, selection));
  await narrowKnowledgeLeaf();
  await expect(el("review-change")).toBeDisplayed();
  await expect(el("review-criterion-check")).toBeEnabled();
  await el("review-criterion-check").click();
  await expect(el("review-confirmed")).toHaveText("1 von 1 bestätigt", { wait: 15_000 });
  const pending = await readVaultText(deliveryPath);
  await press(await el("review-change"));
  await expect(reason()).toBeFocused();
  await expect(dialog()).toHaveText(expect.stringContaining("FR-024 · Revision 2"));
  await expect(dialog()).toHaveText(expect.stringContaining(reviewTestedCommit));
  const size = await browser.execute(
    (panel: HTMLElement) => {
      const { top, bottom } = panel.getBoundingClientRect();
      return { top, bottom, height: panel.ownerDocument.documentElement.clientHeight };
    },
    await dialog(),
  );
  expect(size.top).toBeGreaterThanOrEqual(0);
  expect(size.bottom).toBeLessThanOrEqual(size.height + 1);
  await reason().setValue("   ");
  await press(await dialog().$('[data-testid="review-change-submit"]'));
  await expect(dialog().$("p[role=alert]")).toHaveText("Gib Befund und erwartetes Ergebnis ein.");
  await expect(reason()).toBeFocused();
  expect(await readVaultText(deliveryPath)).toBe(pending);
  await browser.keys("Escape");
  await expect(el("review-change")).toBeFocused();
  await expect(el("review-criterion-check")).toBeChecked();
  await expect(dialog()).not.toExist();

  await press(await el("review-gherkin"));
  await expect(dialog()).toHaveText(expect.stringContaining("SC-09"));
  await expect(dialog()).toHaveText(expect.stringContaining("Gefilterte Fälle exportieren"));
  await browser.keys("Escape");
  await expect(el("review-gherkin")).toBeFocused();

  await press(await el("review-change"));
  await reason().setValue(explanation);
  await browser.executeObsidian(({ app }, path) => {
    const original = app.vault.process.bind(app.vault);
    app.vault.process = (file, change, options) => {
      if (file.path === path) {
        app.vault.process = original;
        return Promise.reject(new Error("Controlled review write refusal"));
      }
      return original(file, change, options);
    };
  }, deliveryPath);
  await press(await dialog().$('[data-testid="review-change-submit"]'));
  await expect(dialog().$('[role="alert"]')).toBeDisplayed();
  await expect(reason()).toHaveValue(explanation);
  expect(await readVaultText(deliveryPath)).toBe(pending);
  await press(await dialog().$('[data-testid="review-change-submit"]'));
  await expect(el("review-saved-decision")).toBeDisplayed({ wait: 20_000 });
  await expect(el("review-saved-decision")).toHaveText(
    expect.stringContaining("Änderung angefragt"),
  );
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(explanation));
  await expect(el("review-criterion-check")).toBeChecked();
  const saved = await readReviewFixture();
  expect(saved.delivery.current.decision).toMatchObject({
    decision: "changes-requested",
    commit: reviewTestedCommit,
    explanation,
    proof: { revision: 2, criteria: ["AC-09"] },
  });

  await browser.reloadObsidian();
  await openView();
  await expect(el("review-saved-decision")).toBeDisplayed({ wait: 20_000 });
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(explanation));
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(reviewTestedCommit));
  expect((await readReviewFixture()).bytes).toBe(saved.bytes);
  await el("review-followup").click();
  await expect(el("request-detail")).toHaveText(expect.stringContaining("FR-024 · Revision 3"));
  await setViewRoute(reviewsRoute(customerProject, selection));
  await expect(el("review-saved-decision")).toHaveText(expect.stringContaining(explanation));
  await expect(el("review-followup")).not.toExist();
  const followup = await readReviewFixture();
  expect(followup.delivery.current.decision).toBeUndefined();
  expect(followup.delivery.history).toMatchObject([
    { revision: 2, decision: saved.delivery.current.decision },
  ]);
});
