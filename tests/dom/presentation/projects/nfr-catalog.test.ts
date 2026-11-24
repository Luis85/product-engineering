import { expect, it } from "vitest";
import { nextTick } from "vue";
import {
  backlogBoardRoute,
  backlogRoute,
  nfrCatalogRoute,
  pbiDetailRoute,
} from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { addProjectMember, projectById } from "../../../../src/application/projects";
import { schemaMarker } from "../../../../src/domain/notes";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";

const one = "nfr-33333333-3333-4333-8333-000000000081";
const two = "nfr-33333333-3333-4333-8333-000000000082";
const member = "project-member-33333333-3333-4333-8333-000000000001";
const folder = "Projects/Kundenportal/NFRs";
const header = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";

const test = (name: string) => `[data-testid="${name}"]`;
const click = (root: HTMLElement, name: string) =>
  find<HTMLButtonElement>(root, test(name)).click();
const text = (root: HTMLElement, selector: string) => find(root, selector).textContent;

function field(root: HTMLElement, name: string, value: string, event = "input") {
  const control = find<HTMLInputElement>(root, test(name));
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

function submit(root: HTMLElement, name: string) {
  find<HTMLFormElement>(root, test(name)).dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
}

function nfr(id: string, title: string, extras = {}) {
  return {
    schema: schemaMarker("nfr", 1),
    id,
    title,
    project_id: first,
    requirement: "Limit exports to the current organization.",
    acceptance: "Zero records from foreign organizations.",
    ...extras,
  };
}

it("creates both classifications, searches across fields, and clears the optional project owner", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await host.runtime.runPromise(addProjectMember(first, member, { name: "Kim", role: "qa" }));
    await navigation.navigate(backlogBoardRoute(first));
    await eventually(() => expect(root.querySelector(test("backlog-board"))).toBeTruthy());
    click(root, "backlog-tab-nfrs");
    await eventually(() => expect(navigation.current()).toEqual(nfrCatalogRoute(first)));
    expect(text(root, ".pe-nfr-empty")).toContain("no NFRs yet");
    click(root, "nfr-create");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, test("nfr-title"))),
    );
    field(root, "nfr-title", "Regulated export");
    field(root, "nfr-requirement", "Every export must match its scope.");
    field(root, "nfr-acceptance", "   ");
    submit(root, "nfr-editor");
    await eventually(() =>
      expect(text(root, `${test("nfr-editor")} [role=alert]`)).toContain("Enter a measurable"),
    );
    expect(root.ownerDocument.activeElement).toBe(find(root, test("nfr-acceptance")));
    field(root, "nfr-acceptance", "Zero foreign rows in 100 exports.");
    field(root, "nfr-owner", member, "change");
    find<HTMLInputElement>(root, '[name=category][value="security"]').click();
    await nextTick();
    find<HTMLInputElement>(root, '[name=category][value="technological"]').click();
    submit(root, "nfr-editor");
    await eventually(() => expect(text(root, ".pe-nfr-register li")).toContain("Kim"));
    expect(text(root, ".pe-nfr-register li")).toContain("ISO/IEC 25010:2023");
    expect(text(root, ".pe-nfr-register li")).toContain("ISO/IEC 27001:2022");
    expect(root.ownerDocument.activeElement).toBe(find(root, test("nfr-row-open")));
    field(root, "nfr-filter", "unclassified", "change");
    await eventually(() => expect(text(root, ".pe-nfr-empty")).toContain("No NFRs match"));
    field(root, "nfr-filter", "27001", "change");
    field(root, "nfr-search", "100 exports");
    await eventually(() => expect(text(root, test("nfr-row-open"))).toBe("Regulated export"));
    field(root, "nfr-search", "explicitly unmatched");
    await eventually(() => expect(root.querySelector(test("nfr-row-open"))).toBeNull());
    find<HTMLButtonElement>(root, '.pe-nfr-catalog button[aria-pressed="true"]').focus();
    const reset = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      ({ textContent }) => textContent?.trim() === "Reset filters",
    );
    reset?.click();
    await eventually(() => expect(root.querySelector(test("nfr-row-open"))).toBeTruthy());
    click(root, "nfr-row-open");
    await eventually(() =>
      expect(find<HTMLInputElement>(root, test("nfr-owner")).value).toBe(member),
    );
    field(root, "nfr-owner", "", "change");
    submit(root, "nfr-editor");
    await eventually(() => expect(text(root, ".pe-nfr-register li")).toContain("Unassigned"));
    const store = await host.runtime.runPromise(NoteStore);
    const record = (await host.runtime.runPromise(store.sources)).find(
      ({ frontmatter }) => frontmatter.title === "Regulated export",
    );
    expect(record?.frontmatter).toMatchObject({
      categories: ["security", "technological"],
      acceptance: "Zero foreign rows in 100 exports.",
    });
    expect(record?.frontmatter).not.toHaveProperty("owner_id");
  });
});

it("shows physical CSV diagnostics and invalidates the confirm action when the Vault or source changes", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(root.querySelector(test("nfr-import"))).toBeTruthy());
    click(root, "nfr-import");
    const source = `${header}\nIndex;"Multiple\nlines";100ms;;security\nIndex;conflict;100ms;;security`;
    await eventually(() => expect(root.querySelector(test("nfr-csv-source"))).toBeTruthy());
    field(root, "nfr-csv-source", source);
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(text(root, `${test("nfr-preview")} [role=alert]`)).toContain("Line 4"),
    );
    expect(find<HTMLButtonElement>(root, test("nfr-csv-confirm")).disabled).toBe(true);
    field(root, "nfr-csv-source", source.slice(0, source.lastIndexOf("\n")));
    await eventually(() => expect(root.querySelector(test("nfr-csv-confirm"))).toBeNull());
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(find<HTMLButtonElement>(root, test("nfr-csv-confirm")).disabled).toBe(false),
    );
    await host.runtime.runPromise(
      host.notes.seed(folder + "/Existing.md", nfr(one, "Index"), "Outside body"),
    );
    click(root, "nfr-csv-confirm");
    await eventually(() =>
      expect(text(root, `${test("nfr-preview")} [role=alert]`)).toContain("Line 2"),
    );
    expect(text(root, `${test("nfr-preview")} [role=status]`)).toContain("0 new");
    expect(find<HTMLButtonElement>(root, test("nfr-csv-confirm")).disabled).toBe(true);
    click(root, "nfr-csv-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, test("nfr-import"))),
    );
    const store = await host.runtime.runPromise(NoteStore);
    const notes = await host.runtime.runPromise(store.sources);
    expect(
      notes
        .filter(({ path }) => path.startsWith(folder + "/"))
        .map(({ frontmatter }) => frontmatter.id),
    ).toEqual([one]);
  });
});

it("keeps the checked CSV preview available after a refused write and skips it on reimport", async () => {
  await withProject(async ({ root, host, navigation }) => {
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(root.querySelector(test("nfr-import"))).toBeTruthy());
    click(root, "nfr-import");
    await eventually(() => expect(root.querySelector(test("nfr-csv-source"))).toBeTruthy());
    const source = `${header}\nRetry;Runs after refusal;100 tests;;`;
    field(root, "nfr-csv-source", source);
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(find<HTMLButtonElement>(root, test("nfr-csv-confirm")).disabled).toBe(false),
    );
    host.notes.setFailWrites(true);
    click(root, "nfr-csv-confirm");
    await eventually(() =>
      expect(root.textContent).toContain("Previously saved rows will be recognized"),
    );
    expect(find<HTMLInputElement>(root, test("nfr-csv-source")).value).toBe(source);
    host.notes.setFailWrites(false);
    click(root, "nfr-csv-confirm");
    await eventually(() =>
      expect(text(root, test("nfr-feedback"))).toBe("1 imported · 0 already present"),
    );
    expect(root.ownerDocument.activeElement).toBe(find(root, test("nfr-import")));
    click(root, "nfr-import");
    await eventually(() => expect(root.querySelector(test("nfr-csv-source"))).toBeTruthy());
    field(root, "nfr-csv-source", source);
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(text(root, test("nfr-preview"))).toContain("0 new · 1 already present"),
    );
    expect(find<HTMLButtonElement>(root, test("nfr-csv-confirm")).disabled).toBe(true);
  });
});

it("preserves a dirty standalone NFR editor when keeping the draft and saves it before navigating", async () => {
  await withProject(async ({ root, navigation }) => {
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(root.querySelector(test("nfr-create"))).toBeTruthy());
    click(root, "nfr-create");
    await eventually(() => expect(root.querySelector(test("nfr-title"))).toBeTruthy());
    field(root, "nfr-title", "Draft boundary");
    field(root, "nfr-requirement", "A specific measurable requirement.");
    field(root, "nfr-acceptance", "100 successful trials.");
    const board = backlogBoardRoute(first);
    const keep = navigation.navigate(board);
    await eventually(() => expect(root.querySelector(test("knowledge-keep-editing"))).toBeTruthy());
    click(root, "knowledge-keep-editing");
    expect(await keep).toBe(false);
    expect(find<HTMLInputElement>(root, test("nfr-title")).value).toBe("Draft boundary");
    const save = navigation.navigate(board);
    await eventually(() => expect(root.querySelector(test("knowledge-save-leave"))).toBeTruthy());
    click(root, "knowledge-save-leave");
    expect(await save).toBe(true);
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(text(root, test("nfr-row-open"))).toBe("Draft boundary"));
  });
});

it("keeps an unsaved draft readable when its backing note is removed outside the editor", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const path = folder + "/After outside removal.md";
    await run(host.notes.seed(path, nfr(one, "Persisted title")));
    await run(rebuildNoteIndex);
    await navigation.navigate(nfrCatalogRoute(first, one));
    await eventually(() =>
      expect(find<HTMLInputElement>(root, test("nfr-title")).value).toBe("Persisted title"),
    );
    field(root, "nfr-title", "Unsaved title");
    const store = await run(NoteStore);
    await run(store.trash(path));
    await run(rebuildNoteIndex);
    await nextTick();
    expect(find<HTMLInputElement>(root, test("nfr-title")).value).toBe("Unsaved title");
    submit(root, "nfr-editor");
    await eventually(() =>
      expect(root.textContent).toContain("The saved requirement is unavailable."),
    );
    expect(find<HTMLInputElement>(root, test("nfr-title")).value).toBe("Unsaved title");
    click(root, "nfr-editor-cancel");
    await eventually(() => expect(navigation.current()).toEqual(nfrCatalogRoute(first)));
    expect((await run(store.sources)).some(({ frontmatter }) => frontmatter.id === one)).toBe(
      false,
    );
  });
});

it("renders inherited acceptance and its actual origin, and removes a stale assignment from the owning NFR", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing fixture project");
    const path = project.folder;
    await run(
      host.notes.seed(path + "/Feature.md", {
        schema: schemaMarker("backlog", 1),
        id: "backlog-33333333-3333-4333-8333-000000000081",
        project_id: first,
        type: "Feature",
        title: "Owned feature",
        "pe-id": "FE-01",
      }),
    );
    await run(
      host.notes.seed(path + "/PBI.md", {
        schema: schemaMarker("backlog", 1),
        id: "backlog-33333333-3333-4333-8333-000000000082",
        project_id: first,
        type: "PBI",
        "pe-id": "UC-09",
        parent: "[[Feature]]",
      }),
    );
    await run(
      host.notes.seed(
        folder + "/Scoped.md",
        nfr(one, "Scope criterion", {
          targets: [
            { kind: "item", id: "FE-01" },
            { kind: "item", id: "TASK-88" },
          ],
        }),
      ),
    );
    await run(
      host.notes.seed(folder + "/Damaged.md", nfr(two, "Damaged criterion", { acceptance: "" })),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(pbiDetailRoute(first, "UC-09"));
    await eventually(() =>
      expect(text(root, '[data-nfr-source="item:UC-09"]')).toContain("Zero records"),
    );
    const origin = find<HTMLButtonElement>(root, '[data-pe-focus-key^="nfr-origin-"]');
    expect(origin.textContent).toBe("Owned feature");
    origin.click();
    await eventually(() => expect(navigation.current()).toEqual(backlogRoute(first, "FE-01")));
    await eventually(() => expect(text(root, "[data-nfr-open-record]")).toBe("Scope criterion"));
    find<HTMLButtonElement>(root, "[data-nfr-open-record]").click();
    await eventually(() =>
      expect(text(root, test("nfr-editor"))).toContain("TASK-88 · Target unavailable"),
    );
    click(root, "nfr-target-choices");
    const stale = find<HTMLInputElement>(root, 'input[value="item:TASK-88"]');
    expect(stale.checked).toBe(true);
    stale.click();
    await eventually(() => expect(root.querySelector('input[value="item:TASK-88"]')).toBeNull());
    submit(root, "nfr-editor");
    const store = await run(NoteStore);
    await eventually(async () =>
      expect({
        targets: (await run(store.readFresh(folder + "/Scoped.md"))).frontmatter.targets,
        alert: root.querySelector('[role="alert"]')?.textContent,
        errors: host.logger.filter(({ level }) => level === "error"),
      }).toEqual({ targets: [{ kind: "item", id: "FE-01" }], alert: undefined, errors: [] }),
    );
    await eventually(() =>
      expect({
        route: navigation.current(),
        error: root.querySelector(`${test("nfr-editor")} [role=alert]`)?.textContent,
      }).toEqual({ route: backlogRoute(first, "FE-01"), error: undefined }),
    );
    await navigation.navigate(nfrCatalogRoute(first, two));
    await eventually(() =>
      expect(text(root, test("nfr-missing"))).toContain("This NFR is unavailable"),
    );
    expect(text(root, '.pe-nfr-catalog section[aria-label="NFR notes needing repair"]')).toContain(
      "Damaged criterion",
    );
  });
});
