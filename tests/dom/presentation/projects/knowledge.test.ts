import { expect, it } from "vitest";
import { projectKnowledgeRoute } from "../../../../src/application/knowledge";
import { NoteStore } from "../../../../src/application/notes";
import {
  addProjectMember,
  createProject,
  projectAdministrationRoute,
  projectMemberChoices,
} from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import {
  find,
  first,
  jobOne,
  jobTwo,
  second,
  seedFoundations,
  vision,
  withProject,
} from "./knowledge-fixture";

const prd = "knowledge-33333333-3333-4333-8333-000000000003";
const wideTitle = "Kundenportal role approvals for external representatives and service partners";
const knowledgePath = "Projects/Kundenportal/Requirement.md";
const mara = "project-member-33333333-3333-4333-8333-000000000001";
it("opens the scoped Knowledge library from the project landing and announces an empty project", async () => {
  await withProject(async ({ root, navigation }) => {
    expect(root.querySelector("[data-testid=project-knowledge-entry]")).not.toBeNull();
    find<HTMLButtonElement>(root, "[data-testid=project-knowledge-entry]").click();
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("Knowledge"));
    expect(navigation.current()).toEqual({ name: "project-knowledge", projectId: first });
    expect(root.querySelector("[data-testid=knowledge-state]")?.textContent).toContain(
      "There are no project notes yet.",
    );
  });
});

function input(control: HTMLInputElement | HTMLSelectElement, value: string) {
  control.value = value;
  control.dispatchEvent(
    new Event(control instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

function goToLibrary(root: HTMLElement) {
  find<HTMLButtonElement>(root, "[data-testid=project-knowledge-entry]").click();
}

function submit(dialog: HTMLElement) {
  find<HTMLButtonElement>(dialog, "button[type=submit]").click();
}

it("shares scoped records with the native palette and restores filter, scroll and keyboard focus after a typed return", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(
      createProject(second, {
        name: "Admin Console",
        description: "Rollen und Zugriffe verwalten",
        repository: "produktteam/admin-console",
      }),
    );
    const frontmatter = {
      schema: "product-engineering.knowledge/v1",
      kind: "prd",
      approval: "draft",
      display_id: "PRD-03",
      requirement_id: "REQ-03",
    };
    await host.runtime.runPromise(
      host.notes.seed(
        knowledgePath,
        {
          ...frontmatter,
          id: prd,
          project_id: first,
          title: wideTitle,
        },
        "## Problem\n\n**Anfrage** über [[Services|Partner]] prüfen. <img src=x>",
      ),
    );
    await host.runtime.runPromise(
      host.notes.seed(
        "Projects/Admin Console/Requirement.md",
        {
          ...frontmatter,
          id: "knowledge-33333333-3333-4333-8333-000000000004",
          project_id: second,
          title: wideTitle,
        },
        "Admin data",
      ),
    );
    goToLibrary(root);
    await eventually(() => {
      expect(root.querySelector("[data-knowledge-record]")?.textContent ?? "").toContain(wideTitle);
    });
    const record = () => find<HTMLButtonElement>(root, `[data-knowledge-record="${prd}"]`);
    await eventually(() => expect(record().textContent).toContain("Anfrage über Partner prüfen."));
    expect(record().querySelector("img")).toBeNull();
    await host.runtime.runPromise(
      host.notes.seed(
        knowledgePath,
        {
          ...frontmatter,
          id: prd,
          project_id: first,
          title: wideTitle,
        },
        "## Problem\n\nExtern bearbeiteter Ausschnitt.",
      ),
    );
    await eventually(() =>
      expect(record().textContent).toContain("Extern bearbeiteter Ausschnitt."),
    );
    expect(root.querySelectorAll("[data-knowledge-record]")).toHaveLength(1);
    const query = () => find<HTMLInputElement>(root, "input[name=knowledge-query]");
    const list = () => find<HTMLElement>(root, "[data-testid=knowledge-library]");
    input(query(), "REQ-03");
    const scroll = root;
    scroll.style.overflowY = "auto";
    scroll.scrollTop = 42;
    record().focus();
    record().click();
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe(wideTitle));
    expect(navigation.current()).toMatchObject({
      name: "project-record",
      projectId: first,
      reference: { kind: "knowledge", recordId: prd },
      origin: { section: "knowledge", reference: { kind: "knowledge", recordId: prd } },
    });
    await host.runtime.runPromise(
      NoteStore.use((store) => store.rename(knowledgePath, "Renamed externally")),
    );
    await eventually(() => {
      expect(
        root.querySelector("[data-testid=knowledge-file]")?.getAttribute("data-note-path"),
      ).toBe("Projects/Kundenportal/Renamed externally.md");
    });
    const openFile = find<HTMLButtonElement>(root, "[data-testid=knowledge-file]");
    openFile.click();
    await eventually(() => {
      expect(host.notes.opened()).toEqual(["Projects/Kundenportal/Renamed externally.md"]);
    });
    find<HTMLButtonElement>(root, "[data-testid=project-record-return]").click();
    await eventually(() => expect(document.activeElement).toBe(record()));
    expect(query().value).toBe("REQ-03");
    expect(list().textContent).toContain("1 note");
    expect(scroll.scrollTop).toBe(42);

    find<HTMLButtonElement>(root, 'button[aria-label="Search project"]').click();
    const paletteQuery = await eventually(() =>
      find<HTMLInputElement>(root, '[role=dialog] input[type="search"]'),
    );
    input(paletteQuery, "PRD-03");
    const palette = find(root, "[role=dialog]");
    await eventually(() => expect(palette.textContent).toContain(wideTitle));
    expect([...palette.querySelectorAll("ol button")]).toHaveLength(1);
    paletteQuery.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await eventually(() =>
      expect(navigation.current()).toMatchObject({
        name: "project-record",
        projectId: first,
        reference: { kind: "knowledge", recordId: prd },
      }),
    );
  });
}, 15_000);

it("uses the library filter to start a PRD and saves its requirement, selected vision and multiple jobs", async () => {
  await withProject(async ({ root, host }) => {
    await seedFoundations(host);
    goToLibrary(root);
    const filter = await eventually(() => find<HTMLSelectElement>(root, "[name=knowledge-filter]"));
    input(filter, "prd");
    const trigger = root.querySelector<HTMLButtonElement>("[data-testid=knowledge-create]");
    expect(trigger).not.toBeNull();
    trigger?.click();
    const dialog = await eventually(() => find<HTMLElement>(root, "[role=dialog]"));
    const kind = find<HTMLSelectElement>(dialog, "[name=kind]");
    expect(kind.value).toBe("prd");
    const title = find<HTMLInputElement>(dialog, "[name=title]");
    expect(title.value).toContain("Kundenportal");
    input(title, "Approval requirements");
    const visionChoice = find<HTMLSelectElement>(dialog, "[name=vision_id]");
    const firstJob = await eventually(() => find<HTMLInputElement>(dialog, `[value="${jobOne}"]`));
    const secondJob = find<HTMLInputElement>(dialog, `[value="${jobTwo}"]`);
    input(visionChoice, vision);
    firstJob.click();
    secondJob.click();
    input(kind, "actor");
    await eventually(() => expect(dialog.querySelector("[name=vision_id]")).toBeNull());
    input(find<HTMLSelectElement>(dialog, "[name=actor_type]"), "system");
    input(kind, "prd");
    await eventually(() =>
      expect(find<HTMLSelectElement>(dialog, "[name=vision_id]").value).toBe(""),
    );
    expect(find<HTMLInputElement>(dialog, `[value="${jobOne}"]`).checked).toBe(false);
    expect(title.value).toBe("Approval requirements");
    input(find<HTMLSelectElement>(dialog, "[name=vision_id]"), vision);
    find<HTMLInputElement>(dialog, `[value="${jobOne}"]`).click();
    find<HTMLInputElement>(dialog, `[value="${jobTwo}"]`).click();
    find<HTMLButtonElement>(dialog, "button[type=submit]").click();
    await eventually(() => expect(root.querySelector("[name=markdown]")).not.toBeNull());
    const path = await eventually(() => {
      const current = root
        .querySelector("[data-testid=knowledge-file]")
        ?.getAttribute("data-note-path");
      if (!current) throw new Error("Missing indexed PRD path");
      return current;
    });
    const note = await host.runtime.runPromise(NoteStore.use((store) => store.readContent(path)));
    expect(note.frontmatter).toMatchObject({
      kind: "prd",
      title: "Approval requirements",
      project_id: first,
      display_id: "PRD-01",
      requirement_id: "REQ-01",
      approval: "draft",
      vision_id: vision,
      job_ids: [jobOne, jobTwo],
    });
    expect(note.frontmatter).not.toHaveProperty("actor_type");
    expect(note.frontmatter).not.toHaveProperty("owner_id");
    expect(note.body).toBe("\n## Problem\n\n## REQ-01\n\n## Goals, scope and success criteria\n");
  });
}, 15_000);

it("filters concepts by subtype and member, offers reset and keeps unfamiliar templates discoverable", async () => {
  await withProject(async ({ host, root, navigation }) => {
    await host.runtime.runPromise(
      addProjectMember(first, mara, { name: "Mara König", role: "product-owner" }),
    );
    const types = [
      [prd, "test-concept", "TST-01", "Acceptance in staging", mara],
      [jobOne, "operations-concept", "OPS-01", "Observe the service", undefined],
      [jobTwo, "older-guide", "GDE-01", "Imported operations guide", undefined],
    ] as const;
    await Promise.all(
      types.map(([id, kind, display_id, title, owner_id]) =>
        host.runtime.runPromise(
          host.notes.seed(`Projects/Kundenportal/${display_id}.md`, {
            schema: "product-engineering.knowledge/v1",
            id,
            kind,
            display_id,
            title,
            owner_id,
            project_id: first,
            approval: "approved",
          }),
        ),
      ),
    );
    await navigation.navigate(projectKnowledgeRoute(first));
    const kind = await eventually(() => find<HTMLSelectElement>(root, "[name=knowledge-filter]"));
    input(kind, "concepts");
    const subtype = await eventually(() =>
      find<HTMLSelectElement>(root, "[name=knowledge-concept]"),
    );
    input(subtype, "operations-concept");
    await eventually(() =>
      expect(root.querySelector("[data-knowledge-record]")?.textContent).toContain(
        "Observe the service",
      ),
    );
    const trigger = find<HTMLButtonElement>(root, "[data-testid=knowledge-create]");
    trigger.click();
    const dialog = await eventually(() => find<HTMLElement>(root, "[role=dialog]"));
    expect(find<HTMLSelectElement>(dialog, "[name=kind]").value).toBe("operations-concept");
    find<HTMLButtonElement>(dialog, "[data-testid=knowledge-create-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(trigger));
    const query = find<HTMLInputElement>(root, "[name=knowledge-query]");
    input(query, "Mara König");
    await eventually(() =>
      expect(root.querySelector("[data-testid=knowledge-state]")?.textContent).toContain(
        "No notes match",
      ),
    );
    input(subtype, "");
    await eventually(() =>
      expect(root.querySelector("[data-knowledge-record]")?.textContent).toContain(
        "Acceptance in staging",
      ),
    );
    const reset = Array.from(root.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Reset filters",
    );
    if (!reset) throw new Error("Missing reset control");
    root.style.overflowY = "auto";
    root.scrollTop = 42;
    reset.focus();
    reset.click();
    await eventually(() =>
      expect(root.querySelectorAll("[data-knowledge-record]")).toHaveLength(3),
    );
    expect(query.value).toBe("");
    expect(document.activeElement).toBe(query);
    expect(root.scrollTop).toBe(42);
    input(kind, "other");
    await eventually(() =>
      expect(root.querySelectorAll("[data-knowledge-record]")).toHaveLength(1),
    );
    expect(root.querySelector("[data-knowledge-record]")?.textContent).toContain(
      "Imported operations guide",
    );
    expect(root.textContent).toContain("Other notes");
  });
}, 15_000);

it("uses the real administration template factory and scoped member choices, and cancels without a write", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(
      addProjectMember(first, mara, { name: "Mara König", role: "product-owner" }),
    );
    await navigation.navigate(projectAdministrationRoute(first, "templates"));
    const control = await eventually(() =>
      find<HTMLButtonElement>(root, "button[data-template=actor]"),
    );
    control.focus();
    control.click();
    const dialog = await eventually(() => find<HTMLElement>(root, "[role=dialog]"));
    const template = find<HTMLSelectElement>(dialog, "[name=kind]");
    const owner = find<HTMLSelectElement>(dialog, "[name=owner_id]");
    expect(template.value).toBe("actor");
    expect(owner.value).toBe("");
    await eventually(() =>
      expect([...owner.options].map(({ textContent }) => textContent)).toEqual([
        "Unassigned",
        "Mara König",
      ]),
    );
    expect(find<HTMLSelectElement>(dialog, "[name=actor_type]").value).toBe("");
    input(find<HTMLInputElement>(dialog, "[name=title]"), "Disposable actor");
    input(owner, mara);
    find<HTMLButtonElement>(dialog, "[data-testid=knowledge-create-cancel]").click();
    await eventually(() => expect(document.activeElement).toBe(control));
    expect(find(root, "[data-section=templates]").getAttribute("aria-selected")).toBe("true");
    expect(navigation.current()).toEqual(projectAdministrationRoute(first, "templates"));
    const records = await host.runtime.runPromise(NoteStore.use((store) => store.list));
    expect(records.map(({ frontmatter }) => frontmatter.schema)).toEqual([
      "product-engineering.project/v1",
    ]);
    expect(await host.runtime.runPromise(projectMemberChoices(first))).toMatchObject([
      { id: mara, name: "Mara König" },
    ]);
    expect(host.notes.opened()).toEqual([]);
  });
});

it("requires a subtype, then saves both actor kinds as scoped Markdown and keeps actor creation out of the team", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(
      addProjectMember(first, mara, { name: "Mara König", role: "product-owner" }),
    );
    await navigation.navigate(projectAdministrationRoute(first, "templates"));
    async function newActor(title: string) {
      const control = await eventually(() =>
        find<HTMLButtonElement>(root, "[data-template=actor]"),
      );
      control.click();
      const dialog = await eventually(() => find<HTMLElement>(root, "[role=dialog]"));
      input(find<HTMLInputElement>(dialog, "[name=title]"), title);
      return dialog;
    }
    const human = await newActor("Mara as service representative");
    expect(human.querySelector("button[type=submit]")).not.toBeNull();
    submit(human);
    await eventually(() =>
      expect(human.querySelector("[name=actor_type]")?.getAttribute("aria-invalid")).toBe("true"),
    );
    expect(host.notes.opened()).toEqual([]);
    input(find<HTMLSelectElement>(human, "[name=actor_type]"), "human");
    submit(human);
    await eventually(() => expect(root.querySelector("[name=markdown]")).not.toBeNull());
    find<HTMLButtonElement>(root, "[data-testid=project-record-return]").click();
    const actorControl = await eventually(() =>
      find<HTMLButtonElement>(root, "[data-template=actor]"),
    );
    await eventually(() => expect(document.activeElement).toBe(actorControl));

    const system = await newActor("Customer Identity Service");
    input(find<HTMLSelectElement>(system, "[name=actor_type]"), "system");
    const owner = find<HTMLSelectElement>(system, "[name=owner_id]");
    await eventually(() => expect(owner.options).toHaveLength(2));
    input(owner, mara);
    submit(system);
    await eventually(() => expect(root.querySelector("[name=markdown]")).not.toBeNull());

    const records = (await host.runtime.runPromise(NoteStore.use((store) => store.list))).filter(
      ({ frontmatter }) => frontmatter.kind === "actor",
    );
    expect(records).toHaveLength(2);
    const humanNote = records.find(({ frontmatter }) => frontmatter.actor_type === "human");
    const systemNote = records.find(({ frontmatter }) => frontmatter.actor_type === "system");
    expect(humanNote?.frontmatter).toMatchObject({
      schema: "product-engineering.knowledge/v1",
      project_id: first,
      display_id: "AKT-01",
      approval: "draft",
      actor_type: "human",
    });
    expect(humanNote?.frontmatter.id).toMatch(/^knowledge-[0-9a-f-]+$/);
    expect(humanNote?.frontmatter).not.toHaveProperty("owner_id");
    expect(systemNote?.frontmatter).toMatchObject({
      project_id: first,
      display_id: "AKT-02",
      actor_type: "system",
      owner_id: mara,
    });
    expect(records.map(({ path }) => host.notes.body(path))).toEqual([
      expect.stringContaining("## Role and goal"),
      expect.stringContaining("## Role and goal"),
    ]);
    expect(host.notes.opened()).toEqual([]);
    expect(await host.runtime.runPromise(projectMemberChoices(first))).toMatchObject([
      { id: mara, name: "Mara König" },
    ]);
  });
}, 15_000);
