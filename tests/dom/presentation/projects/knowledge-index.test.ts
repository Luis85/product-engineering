import { expect, it } from "vitest";
import { projectKnowledgeRoute } from "../../../../src/application/knowledge";
import { createProject } from "../../../../src/application/projects";
import { appSurface } from "../../../../src/presentation/app-surface";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const project = "project-33333333-3333-4333-8333-000000000001";

it("announces a pending and failed index and restores keyboard access when a retry succeeds", async () => {
  const host = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  const navigation = memoryNavigation(appSurface, projectKnowledgeRoute(project));
  let close: (() => void) | undefined;
  try {
    await host.runtime.runPromise(
      createProject(project, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    close = await mountSurface(root, host.runtime, { surface: appSurface, navigation });
    await eventually(() =>
      expect(root.querySelector("[role=status]")?.textContent).toBe("Loading project notes…"),
    );
    host.notes.setFailReads(true);
    await host.vaultReady();
    const retry = await eventually(() => {
      const alert = root.querySelector("[role=alert]");
      expect(alert?.textContent ?? "").toContain("The note index could not be read.");
      const button = alert?.querySelector("button");
      if (!button) throw new Error("Missing retry control");
      return button;
    });
    host.notes.setFailReads(false);
    retry.focus();
    retry.click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-state]")?.textContent ?? "").toContain(
        "There are no project notes yet.",
      ),
    );
    expect(document.activeElement).toBe(root.querySelector("[name=knowledge-query]"));
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}, 12_000);
