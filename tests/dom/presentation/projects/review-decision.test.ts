import { expect, it } from "vitest";
import {
  confirmRequestReady,
  dispatchFeatureRequest,
  readRequestPackagePreview,
  readReviewWorkspace,
  releaseFeatureRequest,
  reviewsRoute,
  simulateFactoryEvent,
} from "../../../../src/application/feature-requests";
import {
  deliveryFixture,
  manual,
  project,
  request,
} from "../../../support/request-delivery-fixture";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";
import { find } from "./knowledge-fixture";

const el = (id: string) => `[data-testid="${id}"]`;

it("keeps guarded review checks durable, returns from the current request, and archives a documented change", async () => {
  const fixture = await deliveryFixture("en");
  const { run, record } = fixture;
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    await run(confirmRequestReady(await record(), manual, 3, true));
    const draft = await record();
    await run(releaseFeatureRequest(draft, (await run(readRequestPackagePreview(draft))).basis));
    await run(dispatchFeatureRequest(await record()));
    await run(simulateFactoryEvent(await record(), "pickup"));
    await run(simulateFactoryEvent(await record(), "verify"));
    const route = reviewsRoute(project, { requestId: request, revision: 1 });
    const view = await mountApp(root, fixture.host.runtime, { initial: route });
    close = view.close;
    const element = (id: string) => find(root, el(id));
    const match = (id: string, text: string) =>
      eventually(() => expect(element(id).textContent).toContain(text));
    await match("review-confirmed", "0 of 1 confirmed");
    element("review-gherkin").click();
    const modal = await eventually(() => find(root, '[role="dialog"]'));
    expect(modal.textContent).toContain("SC-09");
    find(modal, "[data-autofocus]").click();
    await eventually(() => expect(document.activeElement).toBe(element("review-gherkin")));

    element("review-request").click();
    await match("request-return", "Back to review");
    element("request-return").click();
    await eventually(() => expect(document.activeElement).toBe(element("review-request")));
    expect(view.navigation.current()).toEqual(route);
    element("review-criterion-check").click();
    await match("review-confirmed", "1 of 1 confirmed");
    expect((element("review-accept") as HTMLButtonElement).disabled).toBe(false);

    element("review-change").click();
    const reason = await eventually(() => find(root, 'textarea[name="reason"]'));
    expect(document.activeElement).toBe(reason);
    element("review-change-submit").click();
    await eventually(() =>
      expect(find(root, '[role="alert"]').textContent).toContain("Enter the finding"),
    );
    reason.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await eventually(() => expect(document.activeElement).toBe(element("review-change")));
    expect((element("review-criterion-check") as HTMLInputElement).checked).toBe(true);

    element("review-change").click();
    const reopened = await eventually(() =>
      find<HTMLTextAreaElement>(root, 'textarea[name="reason"]'),
    );
    expect(reopened.value).toBe("");
    reopened.value = "Add the filter label to the CSV.";
    reopened.dispatchEvent(new Event("input", { bubbles: true }));
    element("review-change-submit").click();
    await match("review-saved-decision", "Add the filter label to the CSV.");
    expect((element("review-criterion-check") as HTMLInputElement).disabled).toBe(true);
    element("review-followup").click();
    await match("request-detail", "FR-001 · Revision 2");
    expect(await run(readReviewWorkspace(project, request, 1))).toMatchObject({
      confirmed: 1,
      entry: { isCurrent: false, decision: { explanation: "Add the filter label to the CSV." } },
    });
  } finally {
    close?.();
    root.remove();
    await fixture.host.runtime.dispose();
  }
});
