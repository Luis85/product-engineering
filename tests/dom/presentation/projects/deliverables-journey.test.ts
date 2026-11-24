import { expect, it } from "vitest";
import {
  backlogBoardRoute,
  deliverablesRoute,
  deliverablesSnapshot,
  saveDeliverable,
} from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { addProjectMember } from "../../../../src/application/projects";
import { eventually } from "../../../support/wait";
import { find, first, seedFoundations, vision, withProject } from "./knowledge-fixture";

const q = (test: string) => `[data-testid="${test}"]`;
const owner = "project-member-33333333-3333-4333-8333-000000000161";
const output = "deliverable-33333333-3333-4333-8333-000000000162";
const submit = (root: HTMLElement) =>
  find<HTMLButtonElement>(root, '[role="dialog"] button[type="submit"]').click();
const click = (root: HTMLElement, test: string) => find<HTMLButtonElement>(root, q(test)).click();

function setField(root: HTMLElement, selector: string, value: string, event = "input") {
  const element = find<HTMLInputElement | HTMLSelectElement>(root, selector);
  element.value = value;
  element.dispatchEvent(new Event(event, { bubbles: true }));
}

it("creates the deliverable with a real owner and evidence, validates compatibility, and follows the note in both directions", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await run(addProjectMember(first, owner, { name: "Mara König", role: "product-owner" }));
    await seedFoundations(host);
    await run(rebuildNoteIndex);
    await navigation.navigate(backlogBoardRoute(first));
    await eventually(() => expect(root.querySelector(q("backlog-tab-deliverables"))).toBeTruthy());
    click(root, "backlog-tab-deliverables");
    await eventually(() => expect(root.querySelector(q("deliverable-create"))).toBeTruthy());
    click(root, "deliverable-create");
    await eventually(() => expect(root.querySelector(q("deliverable-title"))).toBeTruthy());
    setField(root, q("deliverable-title"), "Vision evidence");
    setField(root, q("deliverable-outcome"), "Review the actual approved Vision");
    setField(root, q("deliverable-due"), "2027-05-30");
    await eventually(() => expect(root.querySelector(`option[value="${owner}"]`)).toBeTruthy());
    setField(root, q("deliverable-owner"), owner, "change");
    setField(root, q("deliverable-knowledge"), vision, "change");
    setField(root, q("deliverable-template"), "operations-concept", "change");
    submit(root);
    await eventually(() => {
      const noteField = find(root, q("deliverable-knowledge"));
      expect(noteField.getAttribute("aria-invalid")).toBe("true");
      expect(root.ownerDocument.activeElement).toBe(noteField);
    });
    setField(root, q("deliverable-template"), "vision", "change");
    submit(root);
    await eventually(() =>
      expect(find(root, q("deliverable-row-owner")).textContent).toBe("Mara König"),
    );
    const { records } = await run(deliverablesSnapshot(first));
    const [record] = records;
    if (!record) throw new Error("Missing deliverable fixture");
    expect(record.values).toMatchObject({
      owner_id: owner,
      knowledge_id: vision,
      due: "2027-05-30",
    });
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-row-title"))),
    );
    click(root, "deliverable-open-note");
    await eventually(() => expect(root.querySelector(q("knowledge-references-tab"))).toBeTruthy());
    click(root, "knowledge-references-tab");
    await eventually(() =>
      expect(find(root, q("knowledge-deliverable-backlink")).textContent).toContain(
        "DEL-01 · Vision evidence",
      ),
    );
    click(root, "knowledge-deliverable-backlink");
    await eventually(() =>
      expect(find<HTMLInputElement>(root, q("deliverable-title")).value).toBe("Vision evidence"),
    );
    setField(root, q("deliverable-edit-status"), "in-review", "change");
    setField(root, q("deliverable-owner"), "", "change");
    submit(root);
    await eventually(() =>
      expect(find<HTMLSelectElement>(root, q("deliverable-row-status")).value).toBe("in-review"),
    );
    expect(find(root, q("deliverable-row-owner")).textContent).toBe("Unassigned");
    click(root, "deliverable-open-note");
    await eventually(() => expect(root.querySelector(q("project-record-return"))).toBeTruthy());
    click(root, "project-record-return");
    await eventually(() =>
      expect(navigation.current()).toEqual(deliverablesRoute(first, record.id)),
    );
    await eventually(() =>
      expect(find<HTMLSelectElement>(root, q("deliverable-knowledge")).value).toBe(vision),
    );
  });
});

it("prepares canonical OPS and opens its normal editor, then clears an outside-deleted link", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await run(
      saveDeliverable(first, output, {
        title: "Night shift",
        outcome: "The team can prepare incident coverage",
        status: "planned",
        template: "operations-concept",
      }),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(deliverablesRoute(first));
    await eventually(() => expect(root.querySelector(q("deliverable-create-note"))).toBeTruthy());
    click(root, "deliverable-create-note");
    await eventually(() => {
      const template = find<HTMLSelectElement>(root, '[role="dialog"] [name="kind"]');
      expect(template.value).toBe("operations-concept");
      expect(template.disabled).toBe(true);
    });
    setField(root, '[role="dialog"] input[name="title"]', "Service operations");
    submit(root);
    await eventually(() => expect(root.querySelector('textarea[name="markdown"]')).toBeTruthy());
    const store = await run(NoteStore);
    const note = (await run(store.list)).find(
      ({ frontmatter }) => frontmatter.deliverable_id === output,
    );
    if (!note) throw new Error("Missing prepared Knowledge fixture");
    expect(note.frontmatter).toMatchObject({
      display_id: "OPS-01",
      kind: "operations-concept",
      approval: "draft",
    });
    click(root, "knowledge-references-tab");
    await eventually(() =>
      expect(root.querySelector(q("knowledge-deliverable-backlink"))).toBeTruthy(),
    );
    click(root, "knowledge-deliverable-backlink");
    await eventually(() => expect(root.querySelector(q("deliverable-cancel"))).toBeTruthy());
    click(root, "deliverable-cancel");
    await eventually(() => expect(root.querySelector(q("deliverable-editor"))).toBeNull());
    await run(store.trash(note.path));
    await run(rebuildNoteIndex);
    await eventually(() =>
      expect(find(root, q("deliverable-missing-note")).textContent).toContain("Link unavailable"),
    );
    click(root, "deliverable-link-note");
    await eventually(() =>
      expect(find<HTMLSelectElement>(root, q("deliverable-knowledge")).value).toBe(
        note.frontmatter.id,
      ),
    );
    expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-knowledge")));
    setField(root, q("deliverable-knowledge"), "", "change");
    submit(root);
    await eventually(() => expect(root.querySelector(q("deliverable-missing-note"))).toBeNull());
    expect(
      (await run(deliverablesSnapshot(first))).records[0]?.values.knowledge_id,
    ).toBeUndefined();
  });
});
