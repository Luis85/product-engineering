import { expect, it } from "vitest";
import { backlogRoute } from "../../../../src/application/backlog";
import { backlogSnapshot } from "../../../../src/application/backlog/service";
import { NoteStore } from "../../../../src/application/notes";
import { projectAdministrationRoute, projectById } from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";

it("opens PBI creation with Backlog and no owner selected and cancels without writing", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await navigation.navigate(backlogRoute(first));
    await eventually(() => expect(root.querySelector("[data-testid=backlog-new]")).toBeTruthy());
    const trigger = find(root, "[data-testid=backlog-new]");
    trigger.focus();
    trigger.click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=backlog-create-UC]")).toBeTruthy(),
    );
    find(root, "[data-testid=backlog-create-UC]").click();
    await eventually(() => {
      const dialog = root.querySelector("[data-testid=backlog-form]");
      expect(dialog?.querySelector<HTMLSelectElement>("[name=state]")?.value).toBe("Backlog");
      expect(
        dialog?.querySelector<HTMLSelectElement>("[name=owner]")?.selectedOptions[0]?.text,
      ).toBe("Unassigned");
    });
    find(root, "[data-testid=backlog-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(trigger));
    expect((await host.runtime.runPromise(backlogSnapshot(first))).items).toEqual([]);
  });
});

it("exposes the PBI template in project administration and restores focus on cancel", async () => {
  await withProject(async ({ root, navigation }) => {
    await navigation.navigate(projectAdministrationRoute(first, "templates"));
    await eventually(() => expect(root.querySelector("[data-template=pbi]")).toBeTruthy());
    const template = find(root, "[data-template=pbi]");
    template.focus();
    template.click();
    await eventually(() => expect(root.querySelector("[data-testid=backlog-form]")).toBeTruthy());
    find(root, "[data-testid=backlog-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(template));
  });
});

it("assigns an entity to the canonical backlog item and follows the reciprocal reference", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const phase = project.folder + "/Kundenservice.md";
    const entity = "knowledge-33333333-3333-4333-8333-000000000001";
    await run(
      host.notes.seed(phase, {
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000011",
        project_id: first,
        "pe-id": "EP-01",
        type: "Epic",
        order: 100,
      }),
    );
    await run(
      host.notes.seed(project.folder + "/Organisation.md", {
        schema: "product-engineering.knowledge/v1",
        id: entity,
        project_id: first,
        display_id: "ENT-01",
        title: "Organisation",
        kind: "entity",
        approval: "draft",
      }),
    );
    await navigation.navigate(backlogRoute(first));
    await eventually(() => expect(root.querySelector("[data-backlog-id=EP-01]")).toBeTruthy());
    find(root, "[data-backlog-id=EP-01] [data-testid=backlog-row-open]").click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=domain-scope] select")).toBeTruthy(),
    );
    const choices = find<HTMLSelectElement>(root, "[data-testid=domain-scope] select");
    choices.value = entity;
    choices.dispatchEvent(new Event("change", { bubbles: true }));
    find(root, "[data-testid=domain-scope] [type=submit]").click();
    const link = `[data-domain-scope-link="${entity}"]`;
    await eventually(() => expect(root.querySelector(link)).toBeTruthy());
    find(root, link).click();
    await eventually(() =>
      expect(root.querySelector("[data-domain-scope-link=EP-01]")).toBeTruthy(),
    );
    find(root, "[data-domain-scope-link=EP-01]").click();
    await eventually(() => expect(root.querySelector("[data-testid=backlog-form]")).toBeTruthy());
    expect(navigation.current()).toEqual(backlogRoute(first, "EP-01"));
  });
});

function changeValue(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  control.value = value;
  control.dispatchEvent(
    new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

it("returns from an entity to the same filtered feature and restores row focus and scroll on close", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const folder = project.folder;
    const title = "Servicefälle verwalten";
    const entity = "knowledge-33333333-3333-4333-8333-000000000002";
    await run(
      host.notes.seed(folder + "/Portal.md", {
        type: "Epic",
        "pe-id": "EP-01",
        order: 1000,
        project_id: first,
      }),
    );
    await run(
      host.notes.seed(folder + "/" + title + ".md", {
        schema: "product-engineering.backlog/v1",
        id: "backlog-33333333-3333-4333-8333-000000000012",
        type: "Feature",
        "pe-id": "FE-01",
        order: 2000,
        parent: "[[Portal]]",
        project_id: first,
      }),
    );
    await run(
      host.notes.seed(folder + "/Organisation.md", {
        schema: "product-engineering.knowledge/v1",
        id: entity,
        project_id: first,
        display_id: "ENT-01",
        title: "Organisation",
        kind: "entity",
        approval: "draft",
        domain_scope: [{ kind: "item", id: "FE-01" }],
      }),
    );
    root.style.overflowY = "auto";
    await navigation.navigate(backlogRoute(first));
    const triggerSelector = "[data-backlog-id=FE-01] [data-testid=backlog-row-open]";
    await eventually(() => expect(root.querySelector(triggerSelector)).toBeTruthy());
    changeValue(find<HTMLInputElement>(root, "[name=backlog-search]"), title);
    const trigger = find(root, triggerSelector);
    trigger.focus();
    trigger.click();
    const outward = `[data-domain-scope-link="${entity}"]`;
    await eventually(() => expect(root.querySelector(outward)).toBeTruthy());
    root.scrollTop = 137;
    find(root, outward).click();
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent?.trim()).toBe("Organisation"),
    );
    find(root, "[data-testid=project-record-return]").click();
    await eventually(() => {
      expect(navigation.current()).toEqual(backlogRoute(first, "FE-01"));
      expect(
        root.querySelector<HTMLInputElement>("[data-testid=backlog-form] input[name=title]")?.value,
      ).toBe(title);
    });
    find(root, "[data-testid=backlog-cancel]").click();
    await eventually(() => {
      expect(navigation.current()).toEqual(backlogRoute(first));
      expect(root.querySelector("[data-testid=backlog-form]")).toBeNull();
      expect(find<HTMLInputElement>(root, "[name=backlog-search]").value).toBe(title);
      expect(root.scrollTop).toBe(137);
      expect(document.activeElement?.getAttribute("data-pe-focus-key")).toBe("backlog-FE-01");
    });
  });
});

it("preserves the filtered reading position and closes a cancelled rank draft without changing title or order", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const folder = project.folder;
    const examples = [
      ["Service umbrella", "Epic", "EP-01", 100],
      ["Review queue", "Feature", "FE-01", 200],
      ["Other work", "Feature", "FE-02", 300],
    ] as const;
    await Promise.all(
      examples.map(([name, type, id, order]) =>
        run(
          host.notes.seed(
            folder + "/" + name + ".md",
            {
              type,
              "pe-id": id,
              order,
              project_id: first,
              ...(type === "Feature" && { parent: "[[Service umbrella]]" }),
            },
            "\n## Current Markdown\n",
          ),
        ),
      ),
    );
    await navigation.navigate(backlogRoute(first));
    const row = "[data-backlog-id=FE-01] [data-testid=backlog-row-open]";
    await eventually(() => expect(root.querySelector(row)).toBeTruthy());
    const search = find<HTMLInputElement>(root, "[name=backlog-search]");
    search.focus();
    changeValue(search, "Review queue");
    await eventually(() => {
      expect(
        root.querySelector("[data-backlog-id=EP-01]")?.getAttribute("data-backlog-context"),
      ).toBe("true");
      expect(root.querySelector("[data-backlog-id=FE-02]")).toBeNull();
    });
    const trigger = find(root, row);
    trigger.focus();
    trigger.click();
    await eventually(() => expect(root.querySelector("[name=title]")).toBeTruthy());
    changeValue(find<HTMLInputElement>(root, "[name=title]"), "Unsaved review title");
    find(root, "[data-testid=backlog-down]").click();
    find(root, "[data-testid=backlog-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(trigger));
    expect(search.value).toBe("Review queue");
    const note = await run(
      NoteStore.use((store) => store.readContent(folder + "/Review queue.md")),
    );
    expect(note.frontmatter).toMatchObject({ order: 200 });
    expect(note.frontmatter).not.toHaveProperty("title");
  });
});

it("protects an edited Markdown draft before history and keeps the saved edition on return", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    await run(
      host.notes.seed(
        project.folder + "/Review.md",
        {
          type: "Epic",
          "pe-id": "EP-01",
          order: 100,
          project_id: first,
        },
        "\n## Original\n",
      ),
    );
    await navigation.navigate(backlogRoute(first));
    const row = "[data-backlog-id=EP-01] [data-testid=backlog-row-open]";
    await eventually(() => expect(root.querySelector(row)).toBeTruthy());
    find(root, row).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=backlog-edit-description]")).toBeTruthy(),
    );
    find(root, "[data-testid=backlog-edit-description]").click();
    await eventually(() => expect(root.querySelector("textarea[name=markdown]")).toBeTruthy());
    const markdown = find<HTMLTextAreaElement>(root, "textarea[name=markdown]");
    changeValue(markdown, "## New section\n\nKeep this draft.");
    const history = "[data-testid=backlog-open-history]";
    find(root, history).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-keep-editing]")).toBeTruthy(),
    );
    find(root, "[data-testid=knowledge-keep-editing]").click();
    expect(markdown.value).toBe("## New section\n\nKeep this draft.");
    find(root, history).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-save-leave]")).toBeTruthy(),
    );
    find(root, "[data-testid=knowledge-save-leave]").click();
    await eventually(() => expect(root.querySelector("[data-testid=git-comparison]")).toBeTruthy());
    const leaveHistory = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Edit item",
    );
    expect(leaveHistory).toBeTruthy();
    leaveHistory?.click();
    await eventually(() =>
      expect(root.querySelector<HTMLTextAreaElement>("textarea[name=markdown]")?.value).toBe(
        "## New section\n\nKeep this draft.",
      ),
    );
  });
});
