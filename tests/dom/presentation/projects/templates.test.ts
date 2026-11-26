import { defineComponent, h } from "vue";
import type { Component } from "vue";
import { expect, it, vi } from "vitest";
import {
  createProject,
  projectAdministrationRoute,
  projectOverviewRoute,
} from "../../../../src/application/projects";
import type { ProjectTemplateId } from "../../../../src/application/projects";
import { appSurface } from "../../../../src/presentation/app-surface";
import type { ProjectTemplateRequest } from "../../../../src/presentation/projects";
import { projectFrame } from "../../../../src/presentation/projects/screens";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const id = "project-33333333-3333-4333-8333-000000000001";

it("opens the owner's template factory preselected and restores the same section and control on cancellation", async () => {
  const host = testRuntime({ language: "en" });
  const root = document.body.appendChild(document.createElement("div"));
  const create = vi.fn<(request: ProjectTemplateRequest) => Component>((request) =>
    defineComponent({
      setup: () => () =>
        h("button", { onClick: request.dismiss, "data-fixture": "cancel" }, "Cancel"),
    }),
  );
  const surface = {
    ...appSurface,
    frame: () =>
      projectFrame(
        [],
        (["prd", "test-concept", "pbi"] as const).map((template) => ({ template, create })),
      ),
  };
  const navigation = memoryNavigation(surface, projectAdministrationRoute(id));
  let close: (() => void) | undefined;
  const control = (template: ProjectTemplateId) =>
    root.querySelector<HTMLButtonElement>(`[data-template="${template}"]`);
  try {
    await host.runtime.runPromise(
      createProject(id, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    await host.vaultReady();
    close = await mountSurface(root, host.runtime, { surface, navigation });
    const tab = await eventually(() => {
      const found = root.querySelector<HTMLButtonElement>("[data-section=templates]");
      expect(found).not.toBeNull();
      return found;
    });
    tab?.click();
    await eventually(() => expect(control("prd")).not.toBeNull());
    expect(control("vision")).toBeNull();
    async function visitTemplate(template: ProjectTemplateId) {
      control(template)?.click();
      const cancel = await eventually(() => {
        const found = root.querySelector<HTMLButtonElement>("[data-fixture=cancel]");
        expect(found).not.toBeNull();
        return found;
      });
      expect(create.mock.lastCall?.[0]).toMatchObject({
        projectId: id,
        template,
        returnTo: { projectId: id, section: "templates", returnTemplate: template },
      });
      cancel?.click();
      await eventually(() => expect(document.activeElement).toBe(control(template)));
      expect(tab?.getAttribute("aria-selected")).toBe("true");
    }
    await visitTemplate("prd");
    await visitTemplate("test-concept");
    await visitTemplate("pbi");
    const returnTo = create.mock.lastCall?.[0].returnTo;
    if (!returnTo) throw new Error("The owning flow needs an administration return route");
    await navigation.navigate(projectOverviewRoute(id));
    await eventually(() => expect(control("pbi")).toBeNull());
    await navigation.navigate(returnTo);
    await eventually(() => {
      expect(root.querySelector("[data-section=templates]")?.getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(document.activeElement).toBe(control("pbi"));
    });
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
});
