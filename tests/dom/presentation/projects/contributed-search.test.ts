import { expect, it, vi } from "vitest";
import {
  createProject,
  projectOverviewRoute,
  projectRecordRoute,
} from "../../../../src/application/projects";
import type {
  ProjectId,
  ProjectRecordRoute,
  ProjectSearchContributor,
  ProjectSearchRecord,
} from "../../../../src/application/projects";
import type { Route } from "../../../../src/application/routes";
import { appSurface } from "../../../../src/presentation/app-surface";
import { projectFrame } from "../../../../src/presentation/projects/screens";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

const first = "project-33333333-3333-4333-8333-000000000001";
const second = "project-33333333-3333-4333-8333-000000000002";
const missing = "This record is unavailable in the current project.";

function entry(
  projectId: ProjectId,
  recordId: string,
  title: string,
): ProjectSearchRecord<ProjectRecordRoute> {
  const reference = { projectId, kind: "knowledge", recordId };
  return {
    ...reference,
    title,
    displayId: "PRD-03",
    route: projectRecordRoute(reference, { section: "overview" }),
  };
}

function find<E extends HTMLElement>(root: HTMLElement, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

async function search(root: HTMLElement, query: string) {
  find<HTMLButtonElement>(root, 'button[aria-label="Search project"]').click();
  return eventually(() => {
    const input = find<HTMLInputElement>(root, 'input[type="search"]');
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return input;
  });
}

it("loads registered records in both leaves and resolves saved links in their own project", async () => {
  const host = testRuntime({ language: "en" });
  const kundenportal = entry(first, "knowledge-customer", "Customer onboarding");
  const admin = entry(second, "knowledge-role", "Role assignment");
  const duplicate = entry(first, "knowledge-duplicate", "Duplicate first copy");
  const wrongProject = {
    ...entry(first, "knowledge-leak", "Wrong project route"),
    route: admin.route,
  };
  const wrongId = {
    ...entry(first, "knowledge-redirect", "Mismatched stable reference"),
    route: kundenportal.route,
  };
  const missingId = entry(first, "", "Missing stable identifier");
  const firstSource = vi.fn<() => ProjectSearchContributor<ProjectRecordRoute>>(() => () => [
    kundenportal,
    duplicate,
    wrongProject,
    wrongId,
    missingId,
  ]);
  const secondSource = vi.fn<() => ProjectSearchContributor<ProjectRecordRoute>>(() => () => [
    admin,
    { ...duplicate, title: "Duplicate second copy" },
  ]);

  const surface = {
    ...appSurface,
    frame: () =>
      projectFrame([() => Promise.resolve(firstSource), () => Promise.resolve(secondSource)]),
  };
  const disposals: (() => void)[] = [];

  async function mount(initial: Route) {
    const root = document.body.appendChild(document.createElement("div"));
    disposals.push(() => root.remove());
    const navigation = memoryNavigation(surface, initial);
    const close = await mountSurface(root, host.runtime, { surface, navigation });
    disposals.push(close);
    return { root, navigation };
  }

  try {
    await host.runtime.runPromise(
      createProject(first, {
        name: "Kundenportal",
        description: "Customer service",
        repository: "team/customer",
      }),
    );
    await host.runtime.runPromise(
      createProject(second, {
        name: "Admin Console",
        description: "Permissions",
        repository: "team/console",
      }),
    );
    await host.vaultReady();
    const left = await mount(projectOverviewRoute(first));
    const right = await mount(appSurface.decode(admin.route));
    await eventually(() => expect(left.root.querySelector("h1")?.textContent).toBe("Kundenportal"));

    const leftQuery = await search(left.root, "PRD-03");
    await eventually(() =>
      expect(find(left.root, '[role="dialog"]').textContent).toContain("Customer onboarding"),
    );
    const palette = find(left.root, '[role="dialog"]');
    expect(palette.textContent).toContain("PRD-03");
    expect(palette.textContent).not.toMatch(
      /Role assignment|Duplicate|Wrong project route|Mismatched stable reference|Missing stable identifier/,
    );
    leftQuery.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await eventually(() =>
      expect(left.root.querySelector("h1")?.textContent).toBe(kundenportal.title),
    );
    expect(left.navigation.current()).toEqual(kundenportal.route);
    await eventually(() => expect(right.root.querySelector("h1")?.textContent).toBe(admin.title));
    expect(right.navigation.current()).toEqual(admin.route);
    expect(right.navigation.history().back).toEqual([]);
    expect(firstSource).toHaveBeenCalledTimes(2);
    expect(secondSource).toHaveBeenCalledTimes(2);

    await left.navigation.back();
    await eventually(() => expect(left.root.querySelector("h1")?.textContent).toBe("Kundenportal"));
    expect(left.navigation.current()).toEqual(projectOverviewRoute(first));
    expect(right.root.querySelector("h1")?.textContent).toBe(admin.title);
    const rightQuery = await search(right.root, "PRD-03");
    expect(rightQuery.value).toBe("PRD-03");
    await eventually(() =>
      expect(find(right.root, '[role="dialog"]').textContent).toContain("Role assignment"),
    );
    expect(find(right.root, '[role="dialog"]').textContent).not.toContain("Customer onboarding");

    await left.navigation.navigate(duplicate.route);
    await eventually(() => expect(left.root.textContent).toContain(missing));
    expect(left.root.textContent).not.toContain(duplicate.title);
  } finally {
    for (const dispose of disposals.toReversed()) dispose();
    await host.runtime.dispose();
  }
}, 12_000);
