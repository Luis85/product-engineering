import { expect, it, vi } from "vitest";
import { backlogRoute, backlogSnapshot } from "../../../../src/application/backlog";
import { NoteStore } from "../../../../src/application/notes";
import {
  addProjectMember,
  newProjectMemberId,
  projectAdministrationRoute,
  projectById,
} from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";

const button = (id: string) => `[data-testid="${id}"]`;
const row = (id: string) => `[data-backlog-id="${id}"]`;
const search = "[name=backlog-search]";

function change(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  control.value = value;
  const event = control instanceof HTMLSelectElement ? "change" : "input";
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

function fill(root: HTMLElement, name: string, value: string) {
  change(
    find<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(root, `[name="${name}"]`),
    value,
  );
}

async function visible(root: HTMLElement, selector: string) {
  await eventually(() => expect(root.querySelector(selector)).toBeTruthy());
  return find(root, selector);
}

it("creates a first PBI from a filtered list, focuses it, and persists scoped owner changes", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const member = await run(newProjectMemberId);
    await run(addProjectMember(first, member, { name: "Mara König", role: "product-owner" }));
    await navigation.navigate(backlogRoute(first));
    const trigger = await visible(root, button("backlog-new"));
    fill(root, "backlog-search", "previous filter");
    trigger.click();
    (await visible(root, button("backlog-create-UC"))).click();
    await visible(root, button("backlog-form"));
    find(root, button("backlog-save")).click();
    await eventually(() =>
      expect(root.querySelector("[role=alert]")?.textContent).toContain("Enter a title"),
    );
    expect((await run(backlogSnapshot(first))).items).toEqual([]);
    fill(root, "title", "Send the handoff");
    fill(root, "epicTitle", "Service desk");
    fill(root, "featureTitle", "Shift handoff");
    await eventually(() =>
      expect(root.querySelector("[name=owner]")?.textContent).toContain("Mara König"),
    );
    fill(root, "owner", "Mara König");
    find(root, button("backlog-save")).click();
    await eventually(() => {
      expect(root.querySelector(button("backlog-form"))).toBeNull();
      expect(document.activeElement?.textContent?.trim()).toBe("Send the handoff");
    });
    expect(find<HTMLInputElement>(root, search).value).toBe("");
    const records = (await run(backlogSnapshot(first))).items;
    expect(records.map(({ kind }) => kind)).toEqual(["EP", "FE", "UC"]);
    const pbi = records.find(({ kind }) => kind === "UC");
    if (!pbi?.id) throw new Error("Missing created PBI");
    const id = pbi.id;
    const control = row(id) + " " + button("backlog-row-open");
    find(root, row(id) + " " + button("backlog-row-edit")).click();
    await visible(root, button("backlog-form"));
    fill(root, "state", "Review");
    fill(root, "priority", "P2");
    fill(root, "owner", "");
    find(root, button("backlog-save")).click();
    await eventually(() =>
      expect(
        root.querySelector(row(id) + " " + button("backlog-row-state"))?.textContent,
      ).toContain("Review"),
    );
    const note = await run(NoteStore.use((store) => store.readFresh(pbi.path)));
    expect(note.frontmatter).toMatchObject({ status: "Review", priority: "P2", "pe-id": pbi.id });
    expect(note.frontmatter).not.toHaveProperty("assignee");
    fill(root, "backlog-status", "Review");
    fill(root, "backlog-priority", "P1");
    await eventually(() => expect(root.textContent).toContain("No items match your filters."));
    fill(root, "backlog-priority", "P2");
    await visible(root, control);
  });
});

function drag(target: HTMLElement, event: string, dataTransfer: DataTransfer, clientY = 0) {
  const simulated = new MouseEvent(event, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(simulated, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(simulated);
}

function drop(source: HTMLElement, target: HTMLElement, y: number) {
  const rect = vi
    .spyOn(target, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 600, 100));
  const transfer = new DataTransfer();
  drag(source, "dragstart", transfer);
  drag(target, "dragover", transfer, y);
  drag(target, "drop", transfer, y);
  drag(source, "dragend", transfer);
  rect.mockRestore();
}

it("discloses with the keyboard, ranks within a focused type, reparents by dropping inside and undoes each move", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const data = [
      ["E1", "Epic", "EP-01", 100, ""],
      ["E2", "Epic", "EP-02", 200, ""],
      ["F1", "Feature", "FE-01", 300, "E1"],
      ["F2", "Feature", "FE-02", 400, "E1"],
      ["F3", "Feature", "FE-03", 500, "E2"],
    ] as const;
    await Promise.all(
      data.map(([name, type, id, order, parent]) =>
        run(
          host.notes.seed(project.folder + "/" + name + ".md", {
            type,
            "pe-id": id,
            order,
            project_id: first,
            ...(parent && { parent: "[[" + parent + "]]" }),
          }),
        ),
      ),
    );
    await navigation.navigate(backlogRoute(first));
    const epicA = row("EP-01");
    const epicB = row("EP-02");
    const featureA = row("FE-01");
    const featureB = row("FE-02");
    const featureC = row("FE-03");
    await visible(root, featureA);
    const disclose = find(root, epicA + " [aria-expanded]");
    disclose.focus();
    disclose.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await eventually(() => expect(root.querySelector(featureA)).toBeNull());
    expect(document.activeElement).toBe(disclose);
    disclose.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await visible(root, featureA);
    fill(root, "backlog-level", "FE");
    await eventually(() => expect(root.querySelector(epicA)).toBeNull());
    const featureOrder = () =>
      [...root.querySelectorAll("[data-backlog-id]")].map((element) =>
        element.getAttribute("data-backlog-id"),
      );
    drop(find(root, featureA), find(root, featureB), 90);
    await eventually(() => expect(featureOrder()).toEqual(["FE-02", "FE-01", "FE-03"]));
    (await visible(root, button("backlog-undo"))).click();
    await eventually(() => expect(featureOrder()).toEqual(["FE-01", "FE-02", "FE-03"]));
    drop(find(root, featureC), find(root, featureA), 10);
    await eventually(() => expect(featureOrder()).toEqual(["FE-03", "FE-01", "FE-02"]));
    expect(find(root, featureC).textContent).toContain("E2");
    (await visible(root, button("backlog-undo"))).click();
    await eventually(() => expect(featureOrder()).toEqual(["FE-01", "FE-02", "FE-03"]));
    fill(root, "backlog-level", "");
    await visible(root, epicB);
    drop(find(root, featureA), find(root, featureC), 90);
    drop(find(root, featureA), find(root, featureB), 50);
    expect(root.querySelector(button("backlog-undo"))).toBeNull();
    drop(find(root, featureA), find(root, epicB), 50);
    const store = await run(NoteStore);
    const file = project.folder + "/F1.md";
    await eventually(async () =>
      expect((await run(store.readFresh(file))).frontmatter.parent).toBe(
        `[[${project.folder}/E2]]`,
      ),
    );
    expect(featureOrder()).toContain("FE-03");
    (await visible(root, button("backlog-undo"))).click();
    await eventually(async () =>
      expect((await run(store.readFresh(file))).frontmatter).toMatchObject({
        parent: "[[E1]]",
        order: 300,
      }),
    );
    expect(root.querySelector(featureC)).not.toBeNull();
    find(root, featureA + " " + button("backlog-row-open")).click();
    const lower = await visible(root, button("backlog-down"));
    lower.focus();
    lower.click();
    find(root, button("backlog-save")).click();
    await eventually(async () =>
      expect((await run(store.readFresh(file))).frontmatter.order).toBeGreaterThan(400),
    );
    (await visible(root, button("backlog-undo"))).click();
    await eventually(async () =>
      expect((await run(store.readFresh(file))).frontmatter.order).toBe(300),
    );
  });
});

it("creates a readable Epic and Feature with one Markdown body each", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await navigation.navigate(backlogRoute(first));
    const markdown = "## Background\n\nOne canonical description.";
    async function create(kind: "EP" | "FE", title: string, parent?: string) {
      (await visible(root, button("backlog-new"))).click();
      (await visible(root, button("backlog-create-" + kind))).click();
      await visible(root, button("backlog-form"));
      fill(root, "title", title);
      if (parent) fill(root, "parent", parent);
      expect(root.querySelectorAll("textarea[name=markdown]")).toHaveLength(1);
      fill(root, "markdown", markdown);
      find(root, button("backlog-save")).click();
      await eventually(() => expect(document.activeElement?.textContent?.trim()).toBe(title));
      const record = (await run(backlogSnapshot(first))).items.find((item) => item.kind === kind);
      if (!record?.id) throw new Error("Missing created " + kind);
      const store = await run(NoteStore);
      expect((await run(store.readContent(record.path))).body).toBe(markdown);
      return { id: record.id, parent: record.parent };
    }
    const epic = await create("EP", "New product area");
    const feature = await create("FE", "Offer handoff", epic.id);
    expect(feature.parent).toBe(epic.id);
    find(root, row(feature.id) + " " + button("backlog-row-open")).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-body]")?.textContent).toBe(markdown),
    );
  });
});

it("opens its registered Base and adopts one existing note without changing the other note", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const firstPath = project.folder + "/Review cases.md";
    const secondPath = project.folder + "/Export cases.md";
    const legacy = { type: "Epic", project_id: first, order: 200, private: "Protected" };
    await run(host.notes.seed(firstPath, { ...legacy, "pbl-id": 8 }, "\n## Protected\n"));
    await run(host.notes.seed(secondPath, legacy));
    await navigation.navigate(backlogRoute(first));
    (await visible(root, button("backlog-open-base"))).click();
    await eventually(() =>
      expect(host.projectFiles.openedBases).toEqual([project.backlogBasePath]),
    );
    const item = `[data-backlog-key="${firstPath}"]`;
    (await visible(root, item + " " + button("backlog-row-open"))).click();
    (await visible(root, button("backlog-adopt"))).click();
    await eventually(() => expect(root.querySelector(button("backlog-adopt"))).toBeNull());
    find(root, button("backlog-cancel")).click();
    await eventually(() =>
      expect(document.activeElement?.textContent?.trim()).toBe("Review cases"),
    );
    find(root, button("backlog-row-open") + ":focus").click();
    (await visible(root, button("backlog-open-note"))).click();
    await eventually(() => {
      expect(host.notes.opened().at(-1)).toBe(firstPath);
      expect(root.querySelector(button("backlog-form"))).toBeNull();
    });
    const store = await run(NoteStore);
    const adopted = await run(store.readContent(firstPath));
    expect(adopted.frontmatter).toMatchObject({
      "pbl-id": 8,
      private: "Protected",
    });
    expect(adopted.frontmatter["pe-id"]).toMatch(/^EP-/);
    expect((await run(store.readFresh(secondPath))).frontmatter).toEqual(legacy);
  });
});

it("explains a missing Base, lets the project configure it, and does not offer a write action", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const project = await host.runtime.runPromise(projectById(first));
    if (!project) throw new Error("Missing project");
    host.projectFiles.bases.delete(project.backlogBasePath);
    await navigation.navigate(backlogRoute(first));
    await eventually(() =>
      expect(root.querySelector("[role=alert]")?.textContent).toContain(
        "Assign a supported project-scoped Base",
      ),
    );
    expect(root.querySelector(button("backlog-new"))).toBeNull();
    const configure = [...root.querySelectorAll("button")].find(
      (control) => control.textContent?.trim() === "Select a Base",
    );
    expect(configure).toBeTruthy();
    configure?.click();
    await eventually(() =>
      expect(navigation.current()).toEqual(projectAdministrationRoute(first, "project")),
    );
  });
});

it("keeps destination rank controls after a keyboard parent change and saves an explicit position", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const data = [
      ["First epic", "Epic", "EP-01", 1000, ""],
      ["Second epic", "Epic", "EP-02", 5000, ""],
      ["Moving feature", "Feature", "FE-01", 2000, "First epic"],
      ["First sibling", "Feature", "FE-02", 3000, "First epic"],
      ["Last feature", "Feature", "FE-03", 7000, "Second epic"],
    ] as const;
    await Promise.all(
      data.map(([name, type, id, order, parent]) =>
        run(
          host.notes.seed(
            project.folder + "/" + name + ".md",
            {
              type,
              "pe-id": id,
              order,
              project_id: first,
              ...(parent && { parent: "[[" + parent + "]]" }),
            },
            "\n## Preserved body\n",
          ),
        ),
      ),
    );
    await navigation.navigate(backlogRoute(first));
    await visible(root, row("FE-01"));
    fill(root, "backlog-level", "FE");
    const trigger = await visible(root, row("FE-01") + " " + button("backlog-row-open"));
    trigger.click();
    await visible(root, button("backlog-form"));
    const position = () => root.querySelector("output")?.textContent?.trim();
    expect(position()).toBe("Position 1 of 3");
    fill(root, "parent", "EP-02");
    await eventually(() => expect(position()).toBe("Position 2 of 2"));
    const up = find<HTMLButtonElement>(root, button("backlog-up"));
    const down = find<HTMLButtonElement>(root, button("backlog-down"));
    expect(up.disabled).toBe(false);
    expect(down.disabled).toBe(true);
    up.focus();
    up.click();
    await eventually(() => {
      expect(position()).toBe("Position 1 of 2");
      expect(document.activeElement).toBe(down);
    });
    const store = await run(NoteStore);
    const path = project.folder + "/Moving feature.md";
    expect((await run(store.readFresh(path))).frontmatter).toMatchObject({
      parent: "[[First epic]]",
      order: 2000,
    });
    find(root, button("backlog-save")).click();
    await eventually(async () => {
      const saved = await run(store.readContent(path));
      expect(saved.frontmatter.parent).toBe(`[[${project.folder}/Second epic]]`);
      expect(saved.frontmatter.order).toBeGreaterThan(2000);
      expect(saved.frontmatter.order).toBeLessThan(7000);
      expect(saved.body).toBe("\n## Preserved body\n");
      expect(document.activeElement).toBe(trigger);
    });
    (await visible(root, button("backlog-undo"))).click();
    await eventually(async () =>
      expect((await run(store.readFresh(path))).frontmatter).toMatchObject({
        parent: "[[First epic]]",
        order: 2000,
      }),
    );

    trigger.click();
    await visible(root, button("backlog-form"));
    fill(root, "parent", "EP-02");
    await eventually(() => expect(position()).toBe("Position 2 of 2"));
    find(root, button("backlog-up")).click();
    fill(root, "parent", "EP-01");
    await eventually(() => expect(position()).toBe("Position 1 of 3"));
    const beforeRevert = await run(store.readContent(path));
    find(root, button("backlog-save")).click();
    await eventually(() => expect(root.querySelector(button("backlog-form"))).toBeNull());
    expect(await run(store.readContent(path))).toEqual(beforeRevert);
    expect(root.querySelector(button("backlog-undo"))).toBeNull();

    trigger.click();
    await visible(root, button("backlog-form"));
    fill(root, "parent", "EP-02");
    await eventually(() => expect(position()).toBe("Position 2 of 2"));
    find(root, button("backlog-up")).click();
    find(root, button("backlog-cancel")).click();
    await eventually(() => expect(document.activeElement).toBe(trigger));
    expect(await run(store.readContent(path))).toEqual(beforeRevert);
    expect(root.querySelector(button("backlog-undo"))).toBeNull();
  });
});
