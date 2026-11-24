import { browser, expect } from "@wdio/globals";
import { it } from "mocha";
import { reviewsRoute } from "../../../src/application/feature-requests";
import { narrowKnowledgeLeaf } from "../knowledge-detail-vault";
import { customerProject } from "../knowledge-vault";
import { deliveryRequest } from "../request-delivery-vault";
import { seedComparisonReviewDecision } from "../review-decision-vault";
import { reviewTestedCommit } from "../review-register-vault";
import { ROOT, setViewRoute } from "../support";

const el = (id: string) => browser.$(`${ROOT} [data-testid="${id}"]`);

it("V20: displays the original FR-024 comparison state with both frozen scenarios and matched proof", async function () {
  this.timeout(90_000);
  await seedComparisonReviewDecision();
  await setViewRoute(reviewsRoute(customerProject, { requestId: deliveryRequest, revision: 2 }));
  await expect(el("request-detail")).toHaveText(expect.stringContaining("Fachliche Review"));
  for (const value of [
    "#47",
    reviewTestedCommit,
    "Mara König",
    "RUN-042",
    "CI bestanden",
    "Ausstehend",
  ]) {
    await expect(el("request-evidence")).toHaveText(expect.stringContaining(value));
  }
  await expect(el("review-confirmed")).toHaveText("0 von 2 bestätigt");
  await expect(el("review-criteria")).toHaveText(expect.stringContaining("AC-01 · SC-091"));
  await expect(el("review-criteria")).toHaveText(expect.stringContaining("AC-02 · SC-092"));
  await expect(el("review-done").$("h2")).toHaveText("Done · 2/3 erfüllt");
  await expect(el("request-nfrs")).toHaveText(expect.stringContaining("Stand unbekannt"));
  await expect(el("request-domain")).toHaveText(expect.stringContaining("Stand unbekannt"));
  await expect(el("review-accept")).toBeDisabled();
  await expect(el("review-change")).toBeEnabled();
  await narrowKnowledgeLeaf();
  const geometry = await browser.execute(
    (root: HTMLElement) => {
      const proof = root.querySelector('[data-testid="request-evidence"]')?.getBoundingClientRect();
      const criteria = root
        .querySelector('[data-testid="review-criteria"]')
        ?.getBoundingClientRect();
      const decision = root.querySelector('[data-testid="review-done"]')?.getBoundingClientRect();
      return {
        overflow: root.scrollWidth - root.clientWidth,
        stacked:
          proof &&
          criteria &&
          decision &&
          proof.bottom <= criteria.top &&
          criteria.bottom <= decision.top,
      };
    },
    await el("request-detail"),
  );
  expect(geometry).toMatchObject({ stacked: true });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});
