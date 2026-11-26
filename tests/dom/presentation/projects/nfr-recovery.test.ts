import { expect, it } from "vitest";
import { nextTick } from "vue";
import {
  backlogBoardRoute,
  backlogRoute,
  nfrCatalogRoute,
} from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { projectById } from "../../../../src/application/projects";
import { schemaMarker } from "../../../../src/domain/notes";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";

const a = "nfr-33333333-3333-4333-8333-000000000081";
const b = "nfr-33333333-3333-4333-8333-000000000082";
const headers = "Titel;Anforderung;Abnahmekriterium;Verantwortlich;Kategorien";
const csv = `${headers}\nA revised feature;Protect the organization;50 correct trials;;security`;
const q = (test: string) => `[data-testid="${test}"]`;

function click(root: HTMLElement, test: string) {
  find<HTMLButtonElement>(root, q(test)).click();
}

function chooseFile(root: HTMLElement, file: Pick<File, "text"> | null) {
  const control = find<HTMLInputElement>(root, q("nfr-csv-file"));
  Object.defineProperty(control, "files", { configurable: true, value: { item: () => file } });
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function inputText(root: HTMLElement, test: string, value: string) {
  const control = find<HTMLInputElement>(root, q(test));
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

it("recovers from a file read failure and ignores a stale file result after a source edit", async () => {
  await withProject(async ({ root, navigation }) => {
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(root.querySelector(q("nfr-import"))).toBeTruthy());
    click(root, "nfr-import");
    await eventually(() => expect(root.querySelector(q("nfr-csv-file"))).toBeTruthy());
    chooseFile(root, { text: () => Promise.reject(new Error("Controlled file refusal")) });
    await eventually(() =>
      expect(root.textContent).toContain("The selected file could not be read."),
    );
    let complete!: (text: string) => void;
    const stale = new Promise<string>((resolve) => {
      complete = resolve;
    });
    chooseFile(root, { text: () => stale });
    await eventually(() =>
      expect(find<HTMLButtonElement>(root, q("nfr-csv-preview")).disabled).toBe(true),
    );
    inputText(
      root,
      "nfr-csv-source",
      `${headers}\nPaste survives;Newest editing source;1 success;;`,
    );
    complete(csv);
    await nextTick();
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(find(root, q("nfr-preview")).textContent).toContain("Paste survives"),
    );
    chooseFile(root, null);
    expect(find(root, q("nfr-preview")).textContent).toContain("Paste survives");
    chooseFile(root, new File([csv], "anforderungen.csv", { type: "text/csv" }));
    await eventually(() =>
      expect(find<HTMLTextAreaElement>(root, q("nfr-csv-source")).value).toBe(csv),
    );
    expect(root.querySelector(q("nfr-csv-confirm"))).toBeNull();
    click(root, "nfr-csv-preview");
    await eventually(() =>
      expect(find(root, q("nfr-preview")).textContent).toContain("A revised feature"),
    );
    click(root, "nfr-csv-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("nfr-import"))),
    );
  });
});

function seedAssignment(id: string, title: string, assigned: boolean) {
  return {
    schema: schemaMarker("nfr", 1),
    id,
    title,
    project_id: first,
    requirement: "Protect the current organization.",
    acceptance: "Exactly zero unrelated rows.",
    targets: assigned ? [{ kind: "item", id: "FE-01" }] : [],
  };
}

function submitAssignments(root: HTMLElement) {
  find<HTMLFormElement>(root, q("nfr-assignment-picker")).dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
}

it("keeps an item draft intact through nested cancellation, write refusal and a stale selected NFR", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const project = await run(projectById(first));
    if (!project) throw new Error("Missing fixture project");
    const feature = project.folder + "/Feature.md";
    const original = project.folder + "/NFRs/First.md";
    const toRemove = project.folder + "/NFRs/Second.md";
    await run(
      host.notes.seed(feature, {
        schema: schemaMarker("backlog", 1),
        id: "backlog-33333333-3333-4333-8333-000000000099",
        project_id: first,
        title: "Existing feature",
        type: "Feature",
        "pe-id": "FE-01",
      }),
    );
    await run(host.notes.seed(original, seedAssignment(a, "First rule", true)));
    await run(host.notes.seed(toRemove, seedAssignment(b, "Second rule", false)));
    await run(rebuildNoteIndex);
    await navigation.navigate(backlogRoute(first, "FE-01"));
    await eventually(() => expect(root.querySelector(q("nfr-assign"))).toBeTruthy());
    const input = find<HTMLInputElement>(root, `${q("backlog-form")} input[name=title]`);
    input.value = "Keep the unsaved title";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const option = (id: string) =>
      find<HTMLInputElement>(root, `${q("nfr-assignment-picker")} input[value="${id}"]`);
    click(root, "nfr-assign");
    await eventually(() => expect(option(a).checked).toBe(true));
    option(a).click();
    await nextTick();
    click(root, "nfr-assign-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("nfr-assign"))),
    );
    expect(input.value).toBe("Keep the unsaved title");
    click(root, "nfr-assign");
    await eventually(() => expect(option(a).checked).toBe(true));
    expect(option(b).checked).toBe(false);
    option(b).click();
    await nextTick();
    host.notes.setFailWrites(true);
    submitAssignments(root);
    await eventually(() =>
      expect(root.querySelector(`${q("nfr-assignment-picker")} [role=alert]`)).toBeTruthy(),
    );
    host.notes.setFailWrites(false);
    const store = await run(NoteStore);
    await run(store.trash(toRemove));
    await run(rebuildNoteIndex);
    await eventually(() =>
      expect(find(root, q("nfr-assignment-picker")).textContent).toContain("Target unavailable"),
    );
    expect(option(b).checked).toBe(true);
    option(b).click();
    await nextTick();
    option(a).click();
    await nextTick();
    submitAssignments(root);
    await eventually(() => expect(root.querySelector(q("nfr-assignment-picker"))).toBeNull());
    expect((await run(store.readFresh(original))).frontmatter.targets).toEqual([]);
    expect((await run(store.readFresh(feature))).frontmatter.title).toBe("Existing feature");
    expect(input.value).toBe("Keep the unsaved title");
    await eventually(() => expect(root.textContent).toContain("No NFRs apply."));
  });
});

it("switches the native table views and focuses creation again after discarding an unassigned draft", async () => {
  await withProject(async ({ root, navigation }) => {
    await navigation.navigate(nfrCatalogRoute(first));
    await eventually(() => expect(root.querySelector(q("nfr-create"))).toBeTruthy());
    click(root, "nfr-create");
    await eventually(() => expect(root.querySelector(q("nfr-title"))).toBeTruthy());
    inputText(root, "nfr-title", "Cancel the first draft");
    click(root, "nfr-editor-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("nfr-create"))),
    );
    click(root, "nfr-create");
    await eventually(() => expect(root.querySelector(q("nfr-title"))).toBeTruthy());
    inputText(root, "nfr-title", "Discard the second draft");
    const leaving = navigation.navigate(backlogRoute(first));
    await eventually(() => expect(root.querySelector(q("knowledge-discard-leave"))).toBeTruthy());
    click(root, "knowledge-discard-leave");
    expect(await leaving).toBe(true);
    await eventually(() => expect(root.querySelector(q("backlog-list"))).toBeTruthy());
    click(root, "backlog-tab-nfrs");
    await eventually(() => expect(root.querySelector(q("nfr-catalog"))).toBeTruthy());
    click(root, "backlog-tab-list");
    await eventually(() => expect(navigation.current()).toEqual(backlogRoute(first)));
    click(root, "backlog-tab-nfrs");
    await eventually(() => expect(root.querySelector(q("nfr-create"))).toBeTruthy());
    click(root, "backlog-tab-board");
    await eventually(() => expect(navigation.current()).toEqual(backlogBoardRoute(first, true)));
  });
});
