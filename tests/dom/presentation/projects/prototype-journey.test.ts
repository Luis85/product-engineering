import { Layer } from "effect";
import { expect, it, vi } from "vitest";
import { backlogRoute, nfrCatalogRoute, pbiDetailRoute } from "../../../../src/application/backlog";
import { AgentChat } from "../../../../src/application/integrations";
import type { ProviderChat } from "../../../../src/application/integrations";
import { knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import {
  prototypesRoute,
  prototypesSnapshot,
  resolvePrototypeSource,
} from "../../../../src/application/prototypes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { isKnowledgeId } from "../../../../src/domain/knowledge";
import type { testRuntime } from "../../../support/runtime";
import { eventually } from "../../../support/wait";
import { find, first, withProject } from "./knowledge-fixture";
import {
  field,
  folder,
  gone,
  map,
  mapFields,
  mapPath,
  panel,
  press,
  section,
  shown,
  testId,
  text,
} from "./story-map-ui-fixture";

const useCase = "UC-09";
const task = "TASK-05";
const pbiPath = `${folder}/UC-09.md`;
const taskPath = `${folder}/TASK-05.md`;
const legacyPath = `${folder}/Prototypes/PT-03.md`;
const legacyTitle = "CSV in the case list";
const legacyId = "prototype-33333333-3333-4333-8333-000000000605";
const nfr = "nfr-33333333-3333-4333-8333-000000000606";
const nfrPath = `${folder}/Export access.md`;
const form = testId("prototype-form");
const detail = testId("prototype-detail");
const sourceLinks = testId("prototype-source-links");
const addPrototype = testId("prototype-create");
const submit = testId("prototype-save");
const edit = testId("prototype-edit");
const cancel = testId("prototype-cancel");
const scopeControl = `${form} select[name="scope"]`;
const link = (id: string) => `[data-prototype-link="${id}"] button`;

async function seed(host: ReturnType<typeof testRuntime>) {
  const run = host.runtime.runPromise.bind(host.runtime);
  const seedNote = (path: string, fields: Record<string, unknown>, body = "") =>
    run(host.notes.seed(path, { project_id: first, ...fields }, body));
  await seedNote(mapPath, mapFields());
  await seedNote(`${folder}/EP-01.md`, {
    schema: "product-engineering.backlog/v1",
    id: "backlog-33333333-3333-4333-8333-000000000609",
    "pe-id": "EP-01",
    title: "Case management",
    type: "Epic",
  });
  await seedNote(`${folder}/FE-01.md`, {
    schema: "product-engineering.backlog/v1",
    id: "backlog-33333333-3333-4333-8333-000000000610",
    "pe-id": "FE-01",
    title: "Filter and export",
    type: "Feature",
    parent: "[[EP-01]]",
  });
  await seedNote(pbiPath, {
    schema: "product-engineering.backlog/v1",
    id: "backlog-33333333-3333-4333-8333-000000000607",
    "pe-id": useCase,
    title: "Export all visible cases",
    type: "PBI",
    parent: "[[FE-01]]",
  });
  await seedNote(
    taskPath,
    {
      schema: "product-engineering.backlog/v1",
      id: "backlog-33333333-3333-4333-8333-000000000608",
      "pe-id": task,
      title: "Prepare test payload",
      type: "Task",
      parent: "[[UC-09]]",
    },
    "Outside context",
  );
  await seedNote(nfrPath, {
    schema: "product-engineering.nfr/v1",
    id: nfr,
    title: "Export access",
    requirement: "Keep exports scoped",
    acceptance: "No outside data",
    categories: [],
    targets: [],
  });
  await seedNote(legacyPath, {
    schema: "product-engineering.prototype/v1",
    id: legacyId,
    display_id: "PT-03",
    title: legacyTitle,
    uc: useCase,
    rev: 2,
    label: "Export CSV",
    output_html: "<main>Saved legacy prototype for the case list.</main>",
  });
  await run(rebuildNoteIndex);
}

async function start(root: HTMLElement, scope: string, title: string) {
  await shown(root, addPrototype);
  press(root, addPrototype);
  await shown(root, form);
  const control = () => find<HTMLSelectElement>(root, scopeControl);
  await eventually(() => expect(control().value).toBe(scope));
  briefField(root, "title", title);
}

function briefField(root: HTMLElement, name: string, value: string, event = "input") {
  const control = find<HTMLInputElement>(root, `${form} [name="${name}"]`);
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

async function stageDesign(
  root: HTMLElement,
  kind: "style-guide" | "design-system",
  title: string,
  body: string,
) {
  const child = `${panel} form:has(textarea[name="body"])`;
  press(root, testId("prototype-draft-" + kind));
  await shown(root, child);
  section(find(root, child), "Use draft").click();
  await eventually(() => expect(find(root, child).textContent).toContain("Enter a valid title"));
  const childForm = find(root, child);
  for (const [name, value] of [
    ["title", title],
    ["body", body],
  ] as const) {
    const input = find<HTMLInputElement>(childForm, `[name="${name}"]`);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  section(childForm, "Use draft").click();
  await gone(root, child);
  return find<HTMLSelectElement>(root, `select[name="${kind}"]`).value;
}

it("authors and reuses a real design note, moves scope to the map, and never invokes the provider", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "unexpected";
  });
  const agentChat = Layer.succeed(AgentChat, { stream });
  await withProject(
    async ({ root, host, navigation }) => {
      const run = host.runtime.runPromise.bind(host.runtime);
      await seed(host);
      const store = await run(NoteStore);
      const before = await run(store.readContent(legacyPath));
      await navigation.navigate(prototypesRoute(first));
      await text(root, '[data-prototype-row="PT-03"]', "Clickable");
      section(find(root, '[data-prototype-row="PT-03"]'), legacyTitle).click();
      await text(root, detail, "Revision 2");
      await shown(root, testId("prototype-preview"));
      expect((await run(store.readContent(legacyPath))).text).toBe(before.text);
      section(find(root, detail), "Back to prototypes").click();
      await start(root, "", "Try an export");
      press(root, submit);
      await text(root, form, "Select a scope that is available");
      await shown(root, `${scopeControl} option[value="UC:${useCase}"]`);
      briefField(root, "scope", `UC:${useCase}`, "change");
      press(root, submit);
      await text(root, form, "Describe the workflow");
      briefField(root, "description", "Review all filtered cases before download.");
      const style = await stageDesign(
        root,
        "style-guide",
        "Portal colours",
        "Use blue for primary actions.",
      );
      press(root, submit);
      await text(root, detail, "Portal colours");
      const record = (await run(prototypesSnapshot(first))).records.find(
        ({ title }) => title === "Try an export",
      );
      if (!record) throw new Error("Missing saved prototype");
      expect(record.values.style_guide_id).toBe(style);
      expect(
        await run(resolvePrototypeSource(first, { kind: "UC", id: useCase, projectId: first })),
      ).toMatchObject({ title: "Export all visible cases", displayId: useCase });
      section(find(root, detail), "Export all visible cases").click();
      await text(root, sourceLinks, legacyTitle);
      await text(root, sourceLinks, record.title);
      press(root, link(record.displayId));
      await shown(root, edit);
      press(root, edit);
      await shown(root, `${scopeControl} option[value="map:${map}"]`);
      briefField(root, "scope", `map:${map}`, "change");
      press(root, submit);
      await text(root, detail, "Revision 2");
      section(find(root, detail), "Review the journey").click();
      await shown(root, testId("story-map-context-prototypes"));
      press(root, testId("story-map-context-prototypes"));
      await text(root, sourceLinks, record.title);
      await navigation.navigate(pbiDetailRoute(first, useCase, "links"));
      await text(root, sourceLinks, legacyTitle);
      await gone(root, link(record.displayId));
      await navigation.navigate(prototypesRoute(first, record.id));
      await text(root, detail, "Portal colours");
      const material = find<HTMLButtonElement>(
        root,
        '[data-pe-focus-key="prototype-design-style-guide"]',
      );
      material.click();
      if (!isKnowledgeId(style)) throw new Error("Expected the canonical style guide ID");
      await eventually(() =>
        expect(navigation.current()).toEqual(
          knowledgeDetailRoute(first, style, {
            section: "prototypes",
            reference: { kind: "prototype", recordId: record.id },
          }),
        ),
      );
      const returnAction = testId("project-record-return");
      await shown(root, returnAction);
      press(root, returnAction);
      await text(root, detail, "Portal colours");
      expect(navigation.current()).toEqual(prototypesRoute(first, record.id));
      await eventually(() =>
        expect(root.ownerDocument.activeElement).toBe(
          find(root, '[data-pe-focus-key="prototype-design-style-guide"]'),
        ),
      );
      expect(stream).not.toHaveBeenCalled();
    },
    undefined,
    undefined,
    agentChat,
  );
}, 20_000);

it("guards a dirty Task editor when a saved child brief tries to leave, and marks an outside-deleted NFR unavailable", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seed(host);
    const store = await run(NoteStore);
    const before = (await run(store.readContent(taskPath))).text;
    expect(
      await run(resolvePrototypeSource(first, { kind: "TASK", projectId: first, id: task })),
    ).toMatchObject({ title: "Prepare test payload" });
    await navigation.navigate(backlogRoute(first, task));
    await text(root, sourceLinks, "No prototypes linked");
    field(root, "title", "Dirty parent title");
    await start(root, `TASK:${task}`, "Task brief");
    briefField(root, "description", "Inspect the fixture.");
    press(root, submit);
    await shown(root, testId("knowledge-keep-editing"));
    press(root, testId("knowledge-keep-editing"));
    await text(root, sourceLinks, "Task brief");
    expect(
      find<HTMLInputElement>(root, `${testId("backlog-form")} input[name="title"]`).value,
    ).toBe("Dirty parent title");
    expect((await run(store.readContent(taskPath))).text).toBe(before);
    press(root, testId("backlog-cancel"));
    await gone(root, testId("backlog-form"));
    await navigation.navigate(nfrCatalogRoute(first, nfr));
    await start(root, `nfr:${nfr}`, "NFR brief");
    briefField(root, "description", "Inspect isolation.");
    press(root, submit);
    await text(root, detail, "Export access");
    await run(host.notes.removeOutside(nfrPath));
    await run(rebuildNoteIndex);
    await text(root, detail, "Source unavailable");
    press(root, edit);
    await shown(root, form);
    press(root, submit);
    await text(root, form, "Select a scope that is available");
    expect(find<HTMLInputElement>(root, `${form} input[name="title"]`).value).toBe("NFR brief");
    press(root, cancel);
    await gone(root, form);
    await navigation.navigate(storyMapsRoute(first, map));
    await shown(root, testId("story-map-context-prototypes"));
  });
}, 20_000);

it("keeps the file's exact text and filename across validation, preview and a manual replacement cancellation", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seed(host);
    const id = "prototype-33333333-3333-4333-8333-000000000697";
    const path = `${folder}/Prototypes/PT-04.md`;
    const inputDialog = testId("prototype-import-form");
    const importHtml = testId("prototype-import-html");
    const html = "\uFEFF<!doctype html>\r\n<p>Grüße ✓</p>\r\n";
    await run(
      host.notes.seed(path, {
        schema: "product-engineering.prototype/v1",
        id,
        display_id: "PT-04",
        title: "Try the portal",
        project_id: first,
        revision: 1,
        source_kind: "UC",
        source_id: useCase,
        source_project_id: first,
        description: "Review the portal.",
      }),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(prototypesRoute(first, id));
    await shown(root, importHtml);
    press(root, importHtml);
    await shown(root, inputDialog);
    press(root, testId("prototype-html-save"));
    await text(root, inputDialog, "Enter a valid UTF-8 HTML document");
    const input = find<HTMLInputElement>(root, testId("prototype-html-file"));
    const file = new File([html], "Portal-Grüße.html", { type: "text/html" });
    Object.defineProperty(input, "files", { value: { item: () => file } });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await eventually(() =>
      expect(find<HTMLTextAreaElement>(root, testId("prototype-html-source")).value).toContain(
        "Grüße ✓",
      ),
    );
    press(root, testId("prototype-html-save"));
    await gone(root, inputDialog);
    await text(root, detail, "Imported HTML");
    const frame = find<HTMLIFrameElement>(root, testId("prototype-preview"));
    expect(frame.getAttribute("srcdoc")).toContain("Grüße ✓");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    const store = await run(NoteStore);
    const saved = await run(store.readFresh(path));
    expect(saved.frontmatter).toMatchObject({
      output_html: html,
      output_file_name: file.name,
      output_provenance: "import",
    });
    const owner = root.ownerDocument.defaultView;
    if (!owner) throw new Error("Expected owner for manual file download");
    const capture = vi.spyOn(owner.URL, "createObjectURL").mockReturnValue("blob:fixture");
    const click = vi.spyOn(owner.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      press(root, testId("prototype-export-html"));
      const [blob] = capture.mock.calls[0] ?? [];
      expect(await (blob as Blob).text()).toBe(html);
      expect(click.mock.instances[0]).toMatchObject({ download: file.name });
    } finally {
      capture.mockRestore();
      click.mockRestore();
    }
    press(root, importHtml);
    await text(root, inputDialog, "Saving replaces the current HTML");
    press(root, testId("prototype-html-cancel"));
    await gone(root, inputDialog);
    expect(await run(store.readFresh(path))).toEqual(saved);
  });
}, 20_000);
