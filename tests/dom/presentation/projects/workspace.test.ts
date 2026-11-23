import { expect, it, vi } from "vitest";
import {
  createProject,
  projectAdministrationRoute,
  projectOverviewRoute,
  projectRecordRoute,
} from "../../../../src/application/projects";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { mountApp } from "../../../support/surface";
import { eventually } from "../../../support/wait";
import type { Route } from "../../../../src/application/routes";
import type { BeforeNavigation } from "../../../../src/presentation/shell";

await preloadSurface();

async function fixture(aiEnabled?: boolean) {
  const host = testRuntime({ language: "en", initialSettings: { aiEnabled } });
  const root = document.body.appendChild(document.createElement("div"));
  const { close, navigation } = await mountApp(root, host.runtime);
  await host.vaultReady();
  return {
    ...host,
    root,
    navigation,
    async dispose() {
      close();
      root.remove();
      await host.runtime.dispose();
    },
  };
}

function button(root: HTMLElement, label: string) {
  return Array.from(root.querySelectorAll("button")).find(
    (target) => target.getAttribute("aria-label") === label || target.textContent?.trim() === label,
  );
}

function projectField(root: HTMLElement, name: string) {
  const input = root.querySelector<HTMLInputElement>(`[role="dialog"] input[name="${name}"]`);
  if (!input) throw new Error(`Project field ${name} is missing`);
  return input;
}

function fill(root: HTMLElement, name: string, value: string) {
  const input = projectField(root, name);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function submit(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[role="dialog"] form');
  if (!form) throw new Error("Project form is missing");
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

it("offers project creation from an empty workspace", async () => {
  const view = await fixture();
  try {
    const create = await eventually(() => {
      const trigger = button(view.root, "Create project");
      expect(trigger).toBeDefined();
      return trigger;
    });
    create?.click();
    await eventually(() => {
      expect(view.root.querySelector('[role="dialog"]')?.textContent).toContain("Product name");
    });
    submit(view.root);
    await eventually(() => expect(document.activeElement).toBe(projectField(view.root, "name")));
    expect(view.projectFiles.bases.size).toBe(0);
    button(view.root, "Cancel")?.click();
    await eventually(() => expect(document.activeElement).toBe(create));
    create?.click();
    await eventually(() => expect(projectField(view.root, "name")).toBeDefined());
    fill(view.root, "name", "Kundenportal");
    fill(view.root, "description", "Serviceprozesse für B2B-Kunden");
    fill(view.root, "repository", "produktteam/kundenportal");
    submit(view.root);
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe("Kundenportal"));
    expect(view.projectFiles.bases.size).toBe(1);
  } finally {
    await view.dispose();
  }
});

it("opens the AI copilot in a right panel after global consent", async () => {
  const view = await fixture(true);
  const id = "project-33333333-3333-4333-8333-000000000001";
  try {
    const current = await view.runtime.runPromise(
      createProject(id, {
        name: "Kundenportal",
        description: "Product description",
        repository: "team/product",
      }),
    );
    await view.navigation.navigate(projectOverviewRoute(id));
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(current.name));
    const open = button(view.root, "AI copilot");
    expect(open).toBeDefined();
    open?.click();
    await eventually(() =>
      expect(view.root.querySelector('[role="dialog"] textarea')).not.toBeNull(),
    );
    expect(view.navigation.current()).toEqual(projectOverviewRoute(id));
  } finally {
    await view.dispose();
  }
});

it("switches through the project picker and returns to the previous project on Back", async () => {
  const view = await fixture();
  try {
    const draft = { description: "Product description", repository: "team/product" };
    const first = await view.runtime.runPromise(
      createProject("project-33333333-3333-4333-8333-000000000001", {
        ...draft,
        name: "Kundenportal",
      }),
    );
    const second = await view.runtime.runPromise(
      createProject("project-33333333-3333-4333-8333-000000000002", {
        ...draft,
        name: "Admin Console",
      }),
    );
    await view.navigation.navigate(projectOverviewRoute(first.id));
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(first.name));
    const trigger = button(view.root, "Switch or create project");
    expect(trigger).toBeDefined();
    trigger?.click();
    const picker = await eventually(() => {
      const dialog = view.root.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).not.toBeNull();
      if (!dialog) throw new Error("Project picker is missing");
      return dialog;
    });
    expect(button(picker, "Create project")).toBeDefined();
    const current = picker.querySelector('button[aria-current="true"]');
    expect(current?.textContent).toContain(first.name);
    expect(current?.textContent).toContain("Active");
    expect(button(picker, second.name)?.textContent).not.toContain("Active");
    const choice = button(picker, second.name);
    const before = view.navigation.history();
    const guard = vi.fn<BeforeNavigation<Route>>(() => false);
    const removeGuard = view.navigation.beforeNavigate(guard);
    choice?.focus();
    choice?.click();
    await eventually(() =>
      expect(guard).toHaveBeenCalledExactlyOnceWith({
        from: projectOverviewRoute(first.id),
        to: projectOverviewRoute(second.id),
        kind: "navigate",
      }),
    );
    expect(view.navigation.history()).toBe(before);
    expect(document.activeElement).toBe(choice);
    removeGuard();
    choice?.click();
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(second.name));
    button(view.root, "Go back")?.click();
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(first.name));
  } finally {
    await view.dispose();
  }
});

it("finds visible sections by keyboard and retains the query when returning", async () => {
  const view = await fixture();
  try {
    const project = await view.runtime.runPromise(
      createProject("project-33333333-3333-4333-8333-000000000001", {
        name: "Kundenportal",
        description: "Product description",
        repository: "team/product",
      }),
    );
    await view.navigation.navigate(projectOverviewRoute(project.id));
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(project.name));
    const trigger = button(view.root, "Search project");
    expect(trigger).toBeDefined();
    trigger?.click();
    async function searchBox() {
      return eventually(() => {
        const field = view.root.querySelector<HTMLInputElement>('input[type="search"]');
        expect(field).not.toBeNull();
        if (!field) throw new Error("Project search field is missing");
        return field;
      });
    }
    const field = await searchBox();
    field.value = "administration";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await eventually(() => expect(view.navigation.current().name).toBe("project-administration"));
    button(view.root, "Go back")?.click();
    await eventually(() => expect(view.navigation.current().name).toBe("project-overview"));
    await eventually(() => expect(document.activeElement).toBe(trigger));
    trigger?.click();
    expect((await searchBox()).value).toBe("administration");
  } finally {
    await view.dispose();
  }
});

it("allows project administration to finish a registration with a missing Base", async () => {
  const view = await fixture();
  const id = "project-33333333-3333-4333-8333-000000000001";
  try {
    view.projectFiles.failBase(true);
    await expect(
      view.runtime.runPromise(
        createProject(id, {
          name: "Kundenportal",
          description: "Product description",
          repository: "team/product",
        }),
      ),
    ).rejects.toMatchObject({ _tag: "ProjectStorageError", reason: "base" });
    view.projectFiles.failBase(false);
    await view.navigation.navigate(projectAdministrationRoute(id));
    const restore = await eventually(() => {
      const found = button(view.root, "Restore backlog Base");
      expect(found).toBeDefined();
      return found;
    });
    restore?.click();
    await eventually(() => expect(view.projectFiles.bases.size).toBe(1));
    expect([...view.projectFiles.bases.values()][0]).toContain(id);
  } finally {
    await view.dispose();
  }
});

it("leaves the current project untouched when an unsaved editor declines project creation", async () => {
  const view = await fixture();
  const id = "project-33333333-3333-4333-8333-000000000001";
  try {
    const current = await view.runtime.runPromise(
      createProject(id, {
        name: "Kundenportal",
        description: "Product description",
        repository: "team/product",
      }),
    );
    await view.navigation.navigate(projectOverviewRoute(id));
    await eventually(() => expect(view.root.querySelector("h1")?.textContent).toBe(current.name));
    const remove = view.navigation.beforeNavigate(() => false);
    try {
      button(view.root, "Switch or create project")?.click();
      const picker = await eventually(() => {
        const dialog = view.root.querySelector<HTMLElement>('[role="dialog"]');
        if (!dialog) throw new Error("Project picker is missing");
        return dialog;
      });
      button(picker, "Create project")?.click();
      await eventually(() => expect(view.root.querySelector("[role=dialog]")).toBeNull());
      expect(view.navigation.current()).toEqual(projectOverviewRoute(id));
    } finally {
      remove();
    }
  } finally {
    await view.dispose();
  }
});

it("keeps a missing record link scoped to its project and restores its administration origin", async () => {
  const view = await fixture();
  const id = "project-33333333-3333-4333-8333-000000000001";
  try {
    await view.runtime.runPromise(
      createProject(id, {
        name: "Kundenportal",
        description: "Product description",
        repository: "team/product",
      }),
    );
    await view.navigation.navigate(
      projectRecordRoute(
        { projectId: id, kind: "knowledge", recordId: "PRD-03" },
        { section: "administration" },
      ),
    );
    await eventually(() =>
      expect(view.root.textContent).toContain("This record is unavailable in the current project."),
    );
    button(view.root, "Return to previous section")?.click();
    await eventually(() =>
      expect(view.navigation.current()).toEqual(projectAdministrationRoute(id)),
    );

    await view.navigation.navigate(
      projectOverviewRoute("project-33333333-3333-4333-8333-000000000002"),
    );
    await eventually(() =>
      expect(view.root.textContent).toContain(
        "This project is unavailable. Choose a project to continue.",
      ),
    );
    button(view.root, "Kundenportal")?.click();
    await eventually(() => expect(view.navigation.current()).toEqual(projectOverviewRoute(id)));
  } finally {
    await view.dispose();
  }
});
