import { expect, it } from "vitest";
import {
  confirmRequestReady,
  dispatchFeatureRequest,
  readFeatureRequestRevision,
  readRequestPackagePreview,
  releaseFeatureRequest,
  reviewsRoute,
  simulateFactoryEvent,
} from "../../../../src/application/feature-requests";
import { EventBus } from "../../../../src/application/shell";
import {
  deliveryFixture,
  manual,
  project,
  request,
} from "../../../support/request-delivery-fixture";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";
import { find, second } from "./knowledge-fixture";

const el = (id: string) => `[data-testid="${id}"]`;
const row = "[data-review-row=FR-001]";

it("updates mounted Reviews from a delivered run and restores focus after precise evidence navigation", async () => {
  const f = await deliveryFixture("en");
  const root = document.body.appendChild(document.createElement("div"));
  const { run, record } = f;
  let close: (() => void) | undefined;
  const matches = (selector: string, content: string) =>
    eventually(() => expect(find(root, selector).textContent).toContain(content));
  try {
    const view = await mountApp(root, f.host.runtime, { initial: reviewsRoute(project) });
    close = view.close;
    await matches(el("review-status"), "once they have a tested commit");
    await run(confirmRequestReady(await record(), manual, 3, true));
    const confirmed = await record();
    await run(
      releaseFeatureRequest(confirmed, (await run(readRequestPackagePreview(confirmed))).basis),
    );
    await run(dispatchFeatureRequest(await record()));
    await run(simulateFactoryEvent(await record(), "pickup"));
    await matches(el("review-status"), "once they have a tested commit");
    await run(simulateFactoryEvent(await record(), "verify"));
    await matches(row, "CSV export");
    const title = find(root, row + " button");
    await matches(row, "In Review");
    await matches(row, "CI passed");
    const commit = find(root, row + " code").title;
    const evidence = await run(readFeatureRequestRevision(project, request, 1));
    expect(commit).toBe(evidence?.technical?.result.commit);
    expect(f.dispatch).toHaveBeenCalledTimes(1);

    title.focus();
    f.dirty.add(f.prdPath);
    await run(
      EventBus.use((bus) =>
        bus.publish({ _tag: "FileModified", path: f.prdPath, extension: "md" }),
      ),
    );
    await matches(row, "Earlier version");
    expect(document.activeElement).toBe(title);
    const before = await run(f.store.readContent((await record()).path));
    title.click();
    await matches(el("request-evidence"), commit);
    expect(view.navigation.current()).toEqual(
      reviewsRoute(project, { requestId: request, revision: 1 }),
    );
    find(root, el("review-return")).click();
    await eventually(() => expect(document.activeElement).toBe(find(root, row + " button")));
    expect((await run(f.store.readContent(before.path))).text).toBe(before.text);
    expect(f.dispatch).toHaveBeenCalledTimes(1);

    await view.navigation.navigate(reviewsRoute(second, { requestId: request, revision: 1 }));
    await matches(el("review-status"), "This review revision is unavailable in this project");
    find(root, el("review-return")).click();
    expect(view.navigation.current()).toEqual(reviewsRoute(second));
  } finally {
    close?.();
    root.remove();
    await f.host.runtime.dispose();
  }
});
