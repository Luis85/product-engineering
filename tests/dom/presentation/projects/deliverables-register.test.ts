import { expect, it } from "vitest";
import {
  backlogBoardRoute,
  boardRequestHandoff,
  deliverablesRoute,
  pbiBoardStage,
  saveDeliverable,
} from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { eventually } from "../../../support/wait";
import { find, first, seedFoundations, vision, withProject } from "./knowledge-fixture";

const q = (test: string) => `[data-testid="${test}"]`;
const output = "deliverable-33333333-3333-4333-8333-000000000096";
const secondOutput = "deliverable-33333333-3333-4333-8333-000000000097";
const open = (root: HTMLElement, test: string) => find<HTMLButtonElement>(root, q(test)).click();

function change(root: HTMLElement, test: string, value: string, event = "input") {
  const control = find<HTMLInputElement | HTMLSelectElement>(root, q(test));
  control.value = value;
  control.dispatchEvent(new Event(event, { bubbles: true }));
}

it("offers the four statuses inline and completes tracking independently of note and delivery states", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seedFoundations(host);
    await run(rebuildNoteIndex);
    await run(
      saveDeliverable(first, output, {
        title: "Training evidence",
        outcome: "A traceable outcome",
        status: "planned",
        knowledge_id: vision,
        template: "vision",
      }),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(deliverablesRoute(first));
    const select = () => find<HTMLSelectElement>(root, q("deliverable-row-status"));
    await eventually(() => expect(select().value).toBe("planned"));
    expect([...select().options].map(({ textContent }) => textContent?.trim())).toEqual([
      "Planned",
      "In progress",
      "In review",
      "Done",
    ]);
    const store = await run(NoteStore);
    const note = (await run(store.list)).find(({ frontmatter }) => frontmatter.id === vision);
    if (!note) throw new Error("Missing Knowledge fixture");
    const before = await run(store.readContent(note.path));
    const delivery = Object.freeze({
      id: "FR-01",
      title: "Existing prepared package",
      pbiId: "UC-01",
      projectId: first,
      state: "released",
      sequence: 1,
    } as const);
    const handoff = () => boardRequestHandoff(first, "UC-01", [delivery]);
    const pbi = { state: "Open", fields: {} } as const;
    const release = handoff();
    const stage = pbiBoardStage(pbi, release);
    select().focus();
    select().value = "done";
    select().dispatchEvent(new Event("change", { bubbles: true }));
    await eventually(async () => {
      const files = await run(store.list);
      expect(files.find(({ frontmatter }) => frontmatter.id === output)?.frontmatter.status).toBe(
        "done",
      );
    });
    await eventually(() => expect(root.ownerDocument.activeElement).toBe(select()));
    expect((await run(store.readContent(note.path))).text).toBe(before.text);
    expect(handoff()).toEqual(release);
    expect(pbiBoardStage(pbi, handoff())).toBe(stage);
  });
});

it("validates required fields, retains guarded edits and cancels without writing", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await navigation.navigate(deliverablesRoute(first));
    await eventually(() => expect(root.querySelector(q("deliverable-empty"))).toBeTruthy());
    open(root, "deliverable-create");
    await eventually(() => expect(root.querySelector(q("deliverable-editor"))).toBeTruthy());
    open(root, "deliverable-save");
    await eventually(() => {
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-title")));
      expect(find(root, q("deliverable-issue")).textContent).toContain("Enter a title");
    });
    change(root, "deliverable-title", "Unsubmitted draft");
    open(root, "deliverable-save");
    await eventually(() => {
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-outcome")));
      expect(find(root, q("deliverable-issue")).textContent).toContain(
        "Describe the expected outcome",
      );
    });
    const moving = navigation.navigate(backlogBoardRoute(first));
    await eventually(() => expect(root.querySelector(q("knowledge-keep-editing"))).toBeTruthy());
    open(root, "knowledge-keep-editing");
    expect(await moving).toBe(false);
    await eventually(() =>
      expect(find<HTMLInputElement>(root, q("deliverable-title")).value).toBe("Unsubmitted draft"),
    );
    open(root, "deliverable-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-create"))),
    );
    expect(
      (await run(NoteStore.use((store) => store.list))).every(
        ({ frontmatter }) => frontmatter.schema !== "product-engineering.deliverable/v1",
      ),
    ).toBe(true);
    await navigation.navigate(deliverablesRoute(first, output));
    await eventually(() => expect(root.textContent).toContain("This deliverable is unavailable."));
  });
});

it("filters live relations, recovers status refusal and preserves a cancelled untyped preparation", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await seedFoundations(host);
    await run(rebuildNoteIndex);
    await run(
      saveDeliverable(first, output, {
        title: "Training evidence",
        outcome: "One note",
        knowledge_id: vision,
        status: "planned",
      }),
    );
    await run(
      saveDeliverable(first, secondOutput, {
        title: "Safety checklist",
        outcome: "Operations can attest it",
        due: "2027-04-30",
        status: "planned",
      }),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(deliverablesRoute(first));
    const select = () => find<HTMLSelectElement>(root, q("deliverable-row-status"));
    await eventually(() => expect(select().value).toBe("planned"));
    change(root, "deliverable-search", "CLEAR customer");
    await eventually(() =>
      expect(find(root, q("deliverable-row-title")).textContent).toContain("Training evidence"),
    );
    change(root, "deliverable-filter-template", "untyped", "change");
    await eventually(() =>
      expect(root.querySelector(q("deliverable-filtered-empty"))).toBeTruthy(),
    );
    open(root, "deliverable-reset");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-search"))),
    );
    change(root, "deliverable-filter-template", "untyped", "change");
    await eventually(() =>
      expect(find(root, q("deliverable-row-title")).textContent).toContain("Safety checklist"),
    );
    expect(root.querySelector('time[datetime="2027-04-30"]')?.textContent).toContain("Apr");
    host.notes.setFailWrites(true);
    change(root, "deliverable-row-status", "in-progress", "change");
    await eventually(() => {
      expect(select().value).toBe("planned");
      expect(root.textContent).toContain("Could not save the note");
    });
    host.notes.setFailWrites(false);
    change(root, "deliverable-filter-status", "planned", "change");
    change(root, "deliverable-row-status", "in-progress", "change");
    await eventually(() => {
      expect(root.querySelector(q("deliverable-filtered-empty"))).toBeTruthy();
      expect(root.ownerDocument.activeElement).toBe(find(root, q("deliverable-filter-status")));
    });
    open(root, "deliverable-reset");
    const list = NoteStore.use((store) => store.list);
    const files = await run(list);
    open(root, "deliverable-create-note");
    const template = () => find<HTMLSelectElement>(root, '[role="dialog"] select[name="kind"]');
    await eventually(() => expect(template().value).toBe("prd"));
    expect(template().disabled).toBe(false);
    template().value = "operations-concept";
    template().dispatchEvent(new Event("change", { bubbles: true }));
    await eventually(() => expect(template().value).toBe("operations-concept"));
    open(root, "knowledge-create-cancel");
    await eventually(() => expect(root.querySelector('[role="dialog"]')).toBeNull());
    expect(await run(list)).toEqual(files);
  });
});
