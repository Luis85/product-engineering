import { expect, it } from "vitest";
import { featureRequestsRoute } from "../../../../src/application/feature-requests";
import type { Route } from "../../../../src/application/routes";
import { EventBus } from "../../../../src/application/shell";
import { appSurface } from "../../../../src/presentation/app-surface";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import {
  deliveryFixture,
  project,
  request,
  scope,
} from "../../../support/request-delivery-fixture";
import { eventually } from "../../../support/wait";
import { find } from "./knowledge-fixture";

const el = (id: string) => `[data-testid="${id}"]`;

it("walks the mounted release, attempts, clarification, evidence, and follow-up with real application commands", async () => {
  const f = await deliveryFixture("en");
  const root = document.body.appendChild(document.createElement("div"));
  const navigation = memoryNavigation<Route>(
    appSurface,
    featureRequestsRoute(project, { requestId: request }),
  );
  let dispose: (() => void) | undefined;
  const matches = (id: string, text: string) =>
    eventually(() => expect(find(root, el(id)).textContent).toContain(text));
  const press = (id: string) =>
    eventually(() => {
      const action = find<HTMLButtonElement>(root, el(id));
      expect(action.disabled).toBe(false);
      action.click();
    });
  const phase = (value: string) => matches("request-state", value);
  const updateSource = (path: string) =>
    f.run(EventBus.use((bus) => bus.publish({ _tag: "FileModified", path, extension: "md" })));
  try {
    dispose = await mountSurface(root, f.host.runtime, { surface: appSurface, navigation });
    await phase("Draft");
    await matches("request-package", "team/customer");
    await matches("request-package", "Requirement");
    const tab = find(root, el("request-tab-package"));
    tab.focus();
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement).toBe(find(root, el("request-tab-evidence")));
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.activeElement).toBe(tab);
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(find(root, el("request-toggle-gates")));
    await press("request-toggle-gates");
    await matches("request-gates", "Selection checked");
    const manual = find<HTMLInputElement>(root, el("request-confirm-ready"));
    expect(find<HTMLButtonElement>(root, el("request-release")).disabled).toBe(true);
    manual.click();
    await press("request-release");
    await phase("Released");
    await press("request-tab-run");
    await matches("request-run", "Local Factory simulation");
    f.dirty.add(f.prdPath);
    await updateSource(f.prdPath);
    await matches("request-stale", "current inputs differ");
    expect(find<HTMLButtonElement>(root, el("request-dispatch")).disabled).toBe(true);
    f.dirty.clear();
    await updateSource(f.prdPath);
    await press("request-dispatch");
    await phase("Queued");
    await press("request-fixture-pickup");
    await phase("Running");
    await press("request-replay-event");
    await press("request-fixture-question");
    await phase("Clarification requested");
    await matches("request-clarification", scope);
    await press("request-answer");
    await matches("request-clarification", "Enter a delivery scope");
    const textarea = find<HTMLTextAreaElement>(root, `${el("request-clarification")} textarea`);
    expect(document.activeElement).toBe(textarea);
    await press("request-scope-change");
    await matches("request-clarification", "Proposed new delivery scope");
    const cancel = [...find(root, el("request-clarification")).querySelectorAll("button")].find(
      (button) => button.textContent === "Cancel",
    );
    expect(cancel).toBeDefined();
    cancel?.click();
    textarea.value = "The selected cases are correct.";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await press("request-answer");
    await phase("Running");
    await press("request-fixture-fail");
    await phase("Failed");
    await press("request-retry");
    await matches("request-attempt", "Attempt 2");
    await press("request-fixture-pickup");
    await phase("Running");
    await press("request-fixture-verify");
    await phase("In Review");
    await matches("request-run-history", "Clarification answered");
    await press("request-tab-evidence");
    await matches("request-evidence", "Technically approved");
    await matches("request-evidence", "Pending");
    await matches("request-evidence", "SC-09");
    await press("request-tab-run");
    await press("request-followup");
    await phase("Draft");
    expect(find(root, el("request-history")).textContent).toContain("FR-001 · Revision 1");
  } finally {
    dispose?.();
    root.remove();
    await f.host.runtime.dispose();
  }
});
