import { Result } from "effect";
import { expect, it } from "vitest";
import { backlogRoute, backlogSnapshot, pbiDetailRoute } from "../../../../src/application/backlog";
import { NoteStore } from "../../../../src/application/notes";
import { projectById } from "../../../../src/application/projects";
import { pbiCriteria } from "../../../../src/domain/backlog";
import { eventually } from "../../../support/wait";
import { find, first, second, withProject } from "./knowledge-fixture";

const pbiTitle = "Export service cases";
const row = "[data-backlog-id=UC-09] [data-testid=backlog-row-open]";
const localPrd = "knowledge-33333333-3333-4333-8333-000000000031";
const foreignPrd = "knowledge-33333333-3333-4333-8333-000000000032";

async function withPbi(test: Parameters<typeof withProject>[0]) {
  await withProject(async (context) => {
    const { root, host, navigation } = context;
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    await run(
      host.notes.seed(
        project.folder + "/Export service cases.md",
        {
          schema: "product-engineering.backlog/v1",
          id: "backlog-33333333-3333-4333-8333-000000000009",
          project_id: first,
          "pe-id": "UC-09",
          type: "PBI",
          order: 100,
        },
        "## Main flow\n\nSelect export.",
      ),
    );
    await navigation.navigate(backlogRoute(first));
    await eventually(() => expect(root.querySelector(row)).toBeTruthy());
    await test(context);
  });
}

it("opens an adopted PBI detail from the filtered list and restores the originating row", async () => {
  await withPbi(async ({ root }) => {
    const filter = find<HTMLInputElement>(root, "[name=backlog-search]");
    filter.value = "export";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const origin = find(root, row);
    origin.focus();
    origin.click();
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe(pbiTitle));
    find(root, "[data-testid=pbi-return]").click();
    await eventually(() => {
      expect(find<HTMLInputElement>(root, "[name=backlog-search]").value).toBe("export");
      expect(document.activeElement).toBe(find(root, row));
    });
  });
});

function fill(root: HTMLElement, selector: string, value: string) {
  const control = find<HTMLInputElement>(root, selector);
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(root: HTMLElement, selector: string, value: string) {
  const control = find<HTMLSelectElement>(root, selector);
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

it("recovers a conflicting draft from the stored Markdown and allows a fresh save", async () => {
  await withPbi(async ({ root, host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const rowItem = (await run(backlogSnapshot(first))).items.find(({ id }) => id === "UC-09");
    if (!rowItem) throw new Error("Missing PBI fixture");
    const store = await run(NoteStore);
    find(root, row).click();
    const tab = "[data-testid=pbi-tab-edit]";
    await eventually(() => expect(root.querySelector(tab)).toBeTruthy());
    find(root, tab).click();
    const editor = "[name=markdown]";
    await eventually(() => expect(root.querySelector(editor)).toBeTruthy());
    fill(root, editor, "Draft body");
    await run(
      store.updateContent(rowItem.path, () => Result.succeed({ body: "Outside body", patch: {} })),
    );
    const submit = "[data-testid=pbi-save]";
    find(root, submit).click();
    const notice = "[data-testid=pbi-edit-form] [role=alert]";
    await eventually(() => expect(root.querySelector(notice)?.textContent).toContain("changed"));
    expect(find<HTMLTextAreaElement>(root, editor).value).toBe("Draft body");
    const reload = [...root.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Load latest saved version",
    );
    if (!reload) throw new Error("Missing reload button");
    reload.click();
    await eventually(() => {
      expect(find<HTMLTextAreaElement>(root, editor).value).toBe("Outside body");
      expect(root.querySelector(notice)).toBeNull();
    });
    fill(root, editor, "Merged body");
    find(root, submit).click();
    await eventually(async () =>
      expect((await run(store.readContent(rowItem.path))).body).toBe("Merged body"),
    );
  });
});

it("refreshes compact entity scope after assigning and removing a direct link", async () => {
  await withPbi(async ({ root, host }) => {
    const id = "knowledge-33333333-3333-4333-8333-000000000061";
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    await run(
      host.notes.seed(project.folder + "/Service Case.md", {
        schema: "product-engineering.knowledge/v1",
        id,
        project_id: first,
        display_id: "ENT-06",
        title: "Service Case",
        kind: "entity",
      }),
    );
    find(root, row).click();
    const tab = "[data-testid=pbi-tab-links]";
    await eventually(() => expect(root.querySelector(tab)).toBeTruthy());
    find(root, tab).click();
    const scope = "[data-testid=domain-scope]";
    const picker = scope + " [name=domain-assignment]";
    await eventually(() => expect(root.querySelector(picker + ` [value="${id}"]`)).toBeTruthy());
    choose(root, picker, id);
    find(root, scope + " [type=submit]").click();
    const result = `[data-testid=pbi-context] [data-pe-focus-key="pbi-entity-${id}"]`;
    await eventually(() => expect(root.querySelector(result)?.textContent).toBe("Service Case"));
    find(root, scope + " [data-domain-remove-assignment]").click();
    await eventually(() => expect(root.querySelector(result)).toBeNull());
  });
});

it("rechecks readiness against the currently saved PRD approval", async () => {
  await withPbi(async ({ root, host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    const current = (await run(backlogSnapshot(first))).items.find(({ id }) => id === "UC-09");
    if (!project || !current) throw new Error("Missing PBI fixture");
    const path = project.folder + "/PRD-03.md";
    await run(
      host.notes.seed(path, {
        schema: "product-engineering.knowledge/v1",
        id: localPrd,
        project_id: first,
        kind: "prd",
        title: "Export requirements",
        display_id: "PRD-03",
        requirement_id: "REQ-03",
        approval: "approved",
      }),
    );
    const store = await run(NoteStore);
    await run(
      store.update(current.path, () =>
        Result.succeed({
          set: { pbi_prd_id: localPrd, pbi_requirement_id: "REQ-03" },
        }),
      ),
    );
    find(root, row).click();
    const next = "[data-testid=pbi-next]";
    await eventually(() =>
      expect(root.querySelector(next)?.textContent).toBe("Approve the product vision"),
    );
    await run(store.update(path, () => Result.succeed({ set: { approval: "draft" } })));
    find(root, "[data-testid=pbi-readiness-refresh]").click();
    await eventually(() =>
      expect(root.querySelector(next)?.textContent).toBe("Approve the linked PRD · PRD-03"),
    );
  });
});

it("creates one unassigned question and reads the same note in the detail and backlog list", async () => {
  await withPbi(async ({ root, host }) => {
    find(root, row).click();
    const tab = "[data-testid=pbi-tab-companions]";
    await eventually(() => expect(root.querySelector(tab)).toBeTruthy());
    find(root, tab).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=pbi-add-companion]")).toBeTruthy(),
    );
    const trigger = find(root, "[data-testid=pbi-add-companion]");
    trigger.click();
    const question = "[data-testid=pbi-companion-Q]";
    await eventually(() => expect(root.querySelector(question)).toBeTruthy());
    const control = find(root, question);
    const purpose = control.getAttribute("aria-describedby");
    expect(control.closest("[role=dialog]")?.textContent).toContain(
      "PBI UC-09 · Export service cases",
    );
    expect(purpose ? root.ownerDocument.getElementById(purpose)?.textContent : "").toContain(
      "answer",
    );
    control.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await eventually(() => {
      expect(root.querySelector(question)).toBeNull();
      expect(root.ownerDocument.activeElement).toBe(trigger);
    });
    trigger.click();
    await eventually(() =>
      expect(root.querySelector(question)?.getAttribute("aria-describedby")).toBe(purpose),
    );
    find(root, question).click();
    await eventually(() => expect(root.querySelector("[data-testid=backlog-form]")).toBeTruthy());
    expect(find<HTMLSelectElement>(root, "[name=owner]").value).toBe("");
    fill(root, "[name=title]", "Which records are included?");
    find(root, "[data-testid=backlog-save]").click();
    await eventually(() => {
      expect(root.querySelector("[data-testid=pbi-companion-list]")?.textContent).toContain(
        "Which records are included?",
      );
      expect(root.querySelector("[data-testid=pbi-companion-count]")?.textContent).toContain(
        "1 open",
      );
    });
    const run = host.runtime.runPromise.bind(host.runtime);
    const matches = (await run(backlogSnapshot(first))).items.filter(
      ({ parent }) => parent === "UC-09",
    );
    expect(matches).toHaveLength(1);
    const [child] = matches;
    if (!child) throw new Error("Missing question");
    expect(child.id).toMatch(/^Q-/);
    expect(child).toMatchObject({ owner: "", kind: "Q" });
    const note = await run(NoteStore.use((store) => store.readContent(child.path)));
    expect(note.frontmatter).toMatchObject({ type: "Question", "pe-id": child.id });
    find(root, "[data-testid=pbi-return]").click();
    await eventually(() =>
      expect(root.querySelector(`[data-backlog-id="${child.id}"]`)?.textContent).toContain(
        "Which records are included?",
      ),
    );
  });
});

it("rejects blank criteria and renders named Gherkin from stable saved identities", async () => {
  await withPbi(async ({ root, host }) => {
    find(root, row).click();
    const tab = "[data-testid=pbi-tab-criteria]";
    const add = "[data-testid=pbi-add-criterion]";
    await eventually(() => expect(root.querySelector(tab)).toBeTruthy());
    find(root, tab).click();
    await eventually(() => expect(root.querySelector(add)).toBeTruthy());
    find(root, add).click();
    const save = "[data-testid=pbi-criterion-save]";
    await eventually(() => expect(root.querySelector(save)).toBeTruthy());
    find(root, save).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=pbi-criterion-invalid]")).toBeTruthy(),
    );
    fill(root, "[name=criterion]", "Include only eligible records");
    fill(root, "[name=scenario]", "Export active service cases");
    fill(root, "[name=given]", "one active case and one closed case");
    fill(root, "[name=when]", "the agent selects export");
    fill(root, "[name=then_step]", "the CSV contains only the active case");
    find(root, save).click();
    const spec = "[data-testid=pbi-gherkin]";
    await eventually(() => {
      expect(host.logger.filter(({ level }) => level === "error")).toEqual([]);
      expect(root.querySelector(spec)?.textContent ?? "").toContain(
        "Then the CSV contains only the active case",
      );
    });
    const gherkin = find(root, spec).textContent;
    expect(gherkin).toMatch(/@UC-09 @AC-[\da-f-]+ @SC-[\da-f-]+/);
    expect(gherkin).toContain("Scenario: Export active service cases");
    const run = host.runtime.runPromise.bind(host.runtime);
    const item = (await run(backlogSnapshot(first))).items.find(({ id }) => id === "UC-09");
    if (!item) throw new Error("Missing PBI");
    const note = await run(NoteStore.use((store) => store.readContent(item.path)));
    const criteria = pbiCriteria(note.frontmatter.pbi_criteria);
    expect(criteria?.[0]?.id).toMatch(/^AC-/);
    expect(criteria?.[0]?.scenario_id).toMatch(/^SC-/);
    expect(criteria).toMatchObject([
      {
        scenario_name: "Export active service cases",
        text: "Include only eligible records",
      },
    ]);
    find(root, "[data-testid=pbi-edit-criterion]").click();
    await eventually(() => expect(root.querySelector(save)).toBeTruthy());
    fill(root, "[name=given]", "discarded edit");
    find(root, "[data-testid=pbi-criterion-cancel]").click();
    await eventually(() => expect(root.querySelector(save)).toBeNull());
    expect(find(root, spec).textContent).toBe(gherkin);
  });
});

it("repairs a foreign source, preserves a dirty Markdown draft, and returns to its source link", async () => {
  await withPbi(async ({ root, host }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing project");
    const sources = [
      [localPrd, first, "Export requirements"],
      [foreignPrd, second, "Foreign requirements"],
    ] as const;
    await Promise.all(
      sources.map(([id, project_id, title]) =>
        run(
          host.notes.seed(project.folder + "/" + title + ".md", {
            schema: "product-engineering.knowledge/v1",
            id,
            project_id,
            title,
            kind: "prd",
            display_id: "PRD-03",
            requirement_id: "REQ-03",
          }),
        ),
      ),
    );
    const item = (await run(backlogSnapshot(first))).items.find(({ id }) => id === "UC-09");
    if (!item) throw new Error("Missing PBI");
    const store = await run(NoteStore);
    await run(
      store.update(item.path, () =>
        Result.succeed({
          set: { pbi_prd_id: foreignPrd, pbi_requirement_id: "REQ-03", keep: ["outside"] },
        }),
      ),
    );
    find(root, row).click();
    const links = "[data-testid=pbi-tab-links]";
    const edit = "[data-testid=pbi-tab-edit]";
    await eventually(() => expect(root.querySelector(links)).toBeTruthy());
    find(root, links).click();
    await eventually(() =>
      expect(root.querySelector("[data-testid=pbi-sources]")?.textContent ?? "").toContain(
        foreignPrd,
      ),
    );
    expect(root.querySelector("[data-testid=pbi-sources]")?.textContent).not.toContain(
      "Foreign requirements",
    );
    find(root, edit).click();
    const prd = "[name=pbi_prd_id]";
    await eventually(() =>
      expect([...find<HTMLSelectElement>(root, prd).options].map(({ value }) => value)).toContain(
        localPrd,
      ),
    );
    expect([...find<HTMLSelectElement>(root, prd).options].map(({ text }) => text)).not.toContain(
      "Foreign requirements",
    );
    choose(root, prd, localPrd);
    fill(
      root,
      "[name=markdown]",
      "## Main flow\n\nSelect CSV.\n\n## Notes\n\nKeep [[Source#Heading|Alias]].",
    );
    find(root, links).click();
    const keep = "[data-testid=knowledge-keep-editing]";
    await eventually(() => expect(root.querySelector(keep)).toBeTruthy());
    find(root, keep).click();
    expect(find<HTMLTextAreaElement>(root, "[name=markdown]").value).toContain("Select CSV.");
    find(root, "[data-testid=pbi-save]").click();
    await eventually(async () =>
      expect((await run(store.readContent(item.path))).frontmatter.pbi_prd_id).toBe(localPrd),
    );
    const ref = "[data-testid=pbi-source-prd]";
    find(root, links).click();
    await eventually(() => expect(root.querySelector(ref)).toBeTruthy());
    const link = find(root, ref);
    link.focus();
    link.click();
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent).toBe("Export requirements"),
    );
    find(root, "[data-testid=project-record-return]").click();
    await eventually(() => {
      expect(find(root, links).getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(find(root, ref));
    });
    const saved = await run(store.readContent(item.path));
    expect(saved.frontmatter).toMatchObject({
      pbi_prd_id: localPrd,
      pbi_requirement_id: "REQ-03",
      keep: ["outside"],
    });
    expect(saved.body).toContain("Keep [[Source#Heading|Alias]].");
  });
});

it("shows a scoped missing PBI with a usable Backlog return", async () => {
  await withPbi(async ({ root, navigation }) => {
    await navigation.navigate(pbiDetailRoute(first, "UC-404"));
    await eventually(() =>
      expect(root.querySelector("[role=alert]")?.textContent ?? "").toContain("unavailable"),
    );
    find(root, "[data-testid=pbi-return]").click();
    await eventually(() => expect(root.querySelector("h1")?.textContent).toBe("Backlog"));
  });
});

it("offers the missing source as its next preparation action without simulating Factory delivery", async () => {
  await withPbi(async ({ root }) => {
    find(root, row).click();
    const next = "[data-testid=pbi-next]";
    await eventually(() =>
      expect(root.querySelector(next)?.textContent ?? "").toBe("Link a PRD requirement"),
    );
    expect(find(root, "[data-testid=pbi-factory-status]").textContent).toContain(
      "No delivery request",
    );
    find(root, next).click();
    await eventually(() => expect(root.querySelector("[name=pbi_prd_id]")).toBeTruthy());
  });
});
