import { Result } from "effect";
import { expect, it } from "vitest";
import { NoteStore } from "../../../../src/application/notes";
import {
  createProject,
  newProjectCriterionId,
  projectAdministrationRoute,
  projectById,
  projectDetails,
  saveProjectCriterion,
  saveProjectDetails,
} from "../../../../src/application/projects";
import { appSurface } from "../../../../src/presentation/app-surface";
import { mountSurface } from "../../../../src/presentation/shell";
import { memoryNavigation } from "../../../../src/presentation/shell/host";
import { preloadSurface } from "../../../support/preload";
import { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";

await preloadSurface();

const id = "project-33333333-3333-4333-8333-000000000001";
type Host = ReturnType<typeof testRuntime>;
type Fixture = { readonly root: HTMLElement; readonly host: Host; readonly notePath: string };

async function withProject(test: (fixture: Fixture) => Promise<void>, missingBase = false) {
  const host = testRuntime({ language: "de" });
  const root = document.body.appendChild(document.createElement("div"));
  let close: (() => void) | undefined;
  try {
    const project = await host.runtime.runPromise(
      createProject(id, {
        name: "Kundenportal",
        description: "Serviceprozesse für B2B-Kunden",
        repository: "produktteam/kundenportal",
      }),
    );
    if (missingBase) host.projectFiles.bases.delete(project.backlogBasePath);
    await host.vaultReady();
    close = await mountSurface(root, host.runtime, {
      surface: appSurface,
      navigation: memoryNavigation(appSurface, projectAdministrationRoute(id)),
    });
    await eventually(() => expect(root.querySelector("[data-section=project]")).not.toBeNull());
    await test({ root, host, notePath: project.notePath });
  } finally {
    close?.();
    root.remove();
    await host.runtime.dispose();
  }
}

function control<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

function button(root: HTMLElement, label: string) {
  const element = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!element) throw new Error(`Missing button ${label}`);
  return element;
}

function input(root: HTMLElement, name: string, value: string) {
  const field = control<HTMLInputElement>(root, `input[name=${name}]`);
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return field;
}

function select(root: HTMLElement, name: string, value: string) {
  const field = control<HTMLSelectElement>(root, `select[name=${name}]`);
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function submit(form: HTMLElement) {
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function press(element: HTMLElement, key: string) {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function dialog(root: HTMLElement) {
  return eventually(() => control(root, "[role=dialog][data-state=open]"));
}

function closed(root: HTMLElement) {
  return eventually(() => expect(root.querySelector("[role=dialog][data-state=open]")).toBeNull());
}

it("shows field errors and conflict recovery while retaining an unrelated draft and Base repair", async () => {
  await withProject(async ({ root, host }) => {
    const details = control(root, "form:has(input[name=vault_folder])");
    const name = input(details, "name", "");
    submit(details);
    await eventually(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    input(details, "name", "Draft name");
    const folder = input(details, "vault_folder", "Nonexistent");
    submit(details);
    await eventually(() => expect(document.activeElement).toBe(folder));
    expect(folder.getAttribute("aria-invalid")).toBe("true");
    const first = await host.runtime.runPromise(projectById(id));
    if (!first) throw new Error("Missing project registration");
    input(details, "vault_folder", first.folder);
    await host.runtime.runPromise(
      saveProjectDetails(first, { ...projectDetails(first), name: "Saved elsewhere" }),
    );
    await eventually(() => expect(control(root, "h1").textContent).toBe("Saved elsewhere"));
    expect(name.value).toBe("Draft name");
    submit(details);
    await eventually(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute("aria-invalid")).toBe("true");
    button(details, "Gespeicherte Projektdaten übernehmen").click();
    await eventually(() => expect(name.value).toBe("Saved elsewhere"));
    input(details, "description", "Renamed safely");
    submit(details);
    await eventually(() => expect(root.textContent).toContain("Renamed safely"));
    const restore = button(root, "Backlog-Base wiederherstellen");
    host.projectFiles.failBase(true);
    restore.click();
    await eventually(() =>
      expect(root.textContent).toContain("Die Backlog-Base konnte nicht zugeordnet werden"),
    );
    host.projectFiles.failBase(false);
    restore.click();
    await eventually(() => expect(root.textContent).not.toContain("Backlog-Base wiederherstellen"));
  }, true);
});

it("keeps a duplicate member and an invalid criterion editable and retains focus on close", async () => {
  await withProject(async ({ root, host }) => {
    control(root, "[data-section=team]").click();
    const add = button(root, "Mitglied hinzufügen");
    add.click();
    let panel = await dialog(root);
    submit(control(panel, "form"));
    await eventually(() =>
      expect(control(panel, "input[name=name]").getAttribute("aria-invalid")).toBe("true"),
    );
    input(panel, "name", "Mara König");
    select(panel, "role", "requirements");
    submit(control(panel, "form"));
    await closed(root);
    await eventually(() =>
      expect(control(root, "tbody").textContent).toContain("Requirements Engineering"),
    );
    add.click();
    panel = await dialog(root);
    const duplicate = input(panel, "name", "Mara König");
    select(panel, "role", "requirements");
    submit(control(panel, "form"));
    await eventually(() => expect(panel.textContent).toContain("bereits eingetragen"));
    expect(document.activeElement).toBe(duplicate);
    input(panel, "name", "Mara Klein");
    submit(control(panel, "form"));
    await closed(root);
    await eventually(() => expect(document.activeElement).toBe(add));
    control(root, "[data-section=definitions]").click();
    const ready = control(root, "[data-phase=ready]");
    const addRule = button(ready, "Kriterium hinzufügen");
    addRule.click();
    panel = await dialog(root);
    submit(control(panel, "form"));
    await eventually(() =>
      expect(control(panel, "input[name=title]").getAttribute("aria-invalid")).toBe("true"),
    );
    input(panel, "title", "Delivery scope documented");
    select(panel, "type", "scope");
    submit(control(panel, "form"));
    await closed(root);
    await eventually(() =>
      expect(control(root, "[data-rule-version]").getAttribute("data-rule-version")).toBe("2"),
    );
    const edit = button(ready, "Bearbeiten");
    edit.click();
    panel = await dialog(root);
    const changed = await host.runtime.runPromise(newProjectCriterionId);
    await host.runtime.runPromise(
      saveProjectCriterion(id, 2, "done", changed, {
        title: "Check delivered",
        type: "manual",
        enabled: true,
      }),
    );
    input(panel, "title", "Stale draft");
    const enabled = control<HTMLInputElement>(panel, "input[name=enabled]");
    enabled.checked = false;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));
    submit(control(panel, "form"));
    await eventually(() =>
      expect(panel.textContent).toContain("in einer anderen Ansicht geändert"),
    );
    button(panel, "Abbrechen").click();
    await closed(root);
    await eventually(() => expect(document.activeElement).toBe(edit));
  });
});

it("uses all keyboard tab destinations and recomputes the active scope when configuration changes", async () => {
  await withProject(async ({ root, host, notePath }) => {
    const initial = control(root, "[data-section=project]");
    const integration = control(root, "[data-section=integrations]");
    initial.focus();
    press(initial, "End");
    await eventually(() => expect(document.activeElement).toBe(integration));
    press(integration, "ArrowRight");
    await eventually(() => expect(document.activeElement).toBe(initial));
    press(initial, "ArrowLeft");
    await eventually(() => expect(document.activeElement).toBe(integration));
    press(integration, "Home");
    await eventually(() => expect(document.activeElement).toBe(initial));
    press(initial, "Escape");
    expect(document.activeElement).toBe(initial);
    control(root, "[data-section=requirements]").click();
    const optional = control<HTMLInputElement>(root, "input[name=research_jtbd_required]");
    optional.checked = false;
    optional.dispatchEvent(new Event("change", { bubbles: true }));
    const saved = () =>
      host.runtime.runPromise(NoteStore.use(({ readFresh }) => readFresh(notePath)));
    await eventually(async () =>
      expect((await saved()).frontmatter.research_jtbd_required).toBe(false),
    );
    integration.click();
    const toggle = control(root, "[role=switch]");
    toggle.focus();
    toggle.click();
    await eventually(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(document.activeElement).toBe(toggle);
    button(root, "MCP-Abfrage testen").click();
    await eventually(() =>
      expect(control(root, "[data-testid=project-mcp-result]").dataset.state).toBe("unavailable"),
    );
    button(root, "Obsidian-Integrationseinstellungen öffnen").click();
    await eventually(() =>
      expect(root.textContent).toContain("Öffne Product Engineering in den Obsidian-Einstellungen"),
    );
    const form = control(root, "form:has(select[name=data_class])");
    select(form, "data_class", "confidential");
    submit(form);
    await eventually(async () =>
      expect((await saved()).frontmatter.data_class).toBe("confidential"),
    );
    await eventually(() =>
      expect(root.querySelector("[data-testid=project-mcp-result]")).toBeNull(),
    );
    await host.runtime.runPromise(
      NoteStore.use(({ update }) =>
        update(notePath, () => Result.succeed({ set: { mcp_read: false } })),
      ),
    );
    await eventually(() => expect(toggle.getAttribute("aria-checked")).toBe("false"));
  });
});
