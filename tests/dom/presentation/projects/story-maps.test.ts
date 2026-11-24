import { expect, it } from "vitest";
import { createKnowledge, knowledgeDetailRoute } from "../../../../src/application/knowledge";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import { eventually } from "../../../support/wait";
import { find, first, second, withProject } from "./knowledge-fixture";
import { createProject } from "../../../../src/application/projects";

const q = (id: string) => `[data-testid="${id}"]`;
const click = (root: HTMLElement, id: string) => find<HTMLButtonElement>(root, q(id)).click();

function change(root: HTMLElement, name: string, value: string) {
  const field = find<HTMLInputElement>(root, `[role="dialog"] [name="${name}"]`);
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

it("creates an independent Story Map from Planning, validates fields, and returns focus to the map row", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const nav = [...root.querySelectorAll<HTMLButtonElement>("nav button")].find(
      (button) => button.textContent?.trim() === "Story Maps",
    );
    expect(nav, "Planning exposes the Story Maps register").toBeDefined();
    const planning = Array.from(nav?.parentElement?.querySelectorAll("button") ?? [], (button) =>
      button.getAttribute("aria-label"),
    );
    expect(planning, "Planning follows the reference navigation order").toEqual([
      "Story Maps",
      "Backlog",
      "Prototypes",
    ]);
    nav?.click();
    await eventually(() =>
      expect(find(root, q("story-maps-empty")).textContent).toContain("No story maps"),
    );
    expect(root.querySelectorAll(q("story-map-create"))).toHaveLength(1);
    click(root, "story-map-create");
    await eventually(() => expect(root.querySelector(q("story-map-submit"))).toBeTruthy());
    click(root, "story-map-submit");
    await eventually(() => {
      const field = find(root, '[role="dialog"] [name="title"]');
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(root.ownerDocument.activeElement).toBe(field);
    });
    change(root, "title", "Hand over service cases");
    click(root, "story-map-submit");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(
        find(root, '[role="dialog"] [name="persona"][aria-invalid="true"]'),
      ),
    );
    change(root, "persona", "Service coordinators");
    click(root, "story-map-submit");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(
        find(root, '[role="dialog"] [name="goal"][aria-invalid="true"]'),
      ),
    );
    change(root, "goal", "Share a verified list in one pass");
    host.notes.setFailWrites(true);
    click(root, "story-map-submit");
    await eventually(() =>
      expect(find(root, '[role="dialog"] [role="alert"]').textContent).toContain("save"),
    );
    expect(find<HTMLInputElement>(root, '[role="dialog"] [name="title"]').value).toBe(
      "Hand over service cases",
    );
    host.notes.setFailWrites(false);
    click(root, "story-map-submit");
    await eventually(() =>
      expect(find(root, q("story-map-detail")).textContent).toContain("Hand over service cases"),
    );
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    const maps = (await run(store.list)).filter(
      ({ frontmatter }) => frontmatter.schema === "product-engineering.story-map/v1",
    );
    expect(maps.map(({ frontmatter }) => frontmatter)).toEqual([
      expect.objectContaining({
        project_id: first,
        display_id: "SM-01",
        title: "Hand over service cases",
        persona: "Service coordinators",
        goal: "Share a verified list in one pass",
        activities: [],
        steps: [],
        slices: [],
        cards: [],
      }),
    ]);
    find<HTMLButtonElement>(
      root,
      `${q("story-map-detail")} [data-testid="story-map-open-note"]`,
    ).click();
    await eventually(() => expect(host.notes.opened()).toEqual(maps.map(({ path }) => path)));
    await navigation.back();
    await eventually(() => expect(root.querySelector(q("story-map-row"))).toBeTruthy());
    const row = find<HTMLButtonElement>(root, q("story-map-row"));
    row.focus();
    row.click();
    await eventually(() => expect(root.querySelector(q("story-map-detail"))).toBeTruthy());
    find<HTMLButtonElement>(root, '[data-testid="frame-history"] button').click();
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("story-map-row"))),
    );
  });
});

it("renders live scoped linked-story counts and isolates identical display IDs between projects", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const other = await run(
      createProject(second, {
        name: "Operations",
        description: "Other project",
        repository: "team/operations",
      }),
    );
    const customer = "Product Engineering/Projects/Kundenportal";
    const mapId = "story-map-33333333-3333-4333-8333-000000000211";
    const otherMap = "story-map-33333333-3333-4333-8333-000000000212";
    const itemPath = `${customer}/Team feature.md`;
    const feature = {
      schema: "product-engineering.backlog/v1",
      type: "Feature",
      "pe-id": "FE-01",
      id: "backlog-33333333-3333-4333-8333-000000000213",
      project_id: first,
    };
    await run(host.notes.seed(itemPath, feature));
    const fields = {
      schema: "product-engineering.story-map/v1",
      display_id: "SM-01",
      persona: "Service coordinator",
      goal: "Pass a verified queue",
      activities: [],
      steps: [],
      slices: [],
      cards: [{ id: "CARD-01", stepId: "STEP-01", title: "See team work" }],
      card_links: [{ cardId: "CARD-01", kind: "item", projectId: first, recordId: "FE-01" }],
    };
    const mapPath = `${customer}/Story Maps/SM-01.md`;
    await run(
      host.notes.seed(mapPath, { ...fields, project_id: first, id: mapId, title: "First map" }),
    );
    await run(
      host.notes.seed(`${other.folder}/Story Maps/SM-01.md`, {
        ...fields,
        project_id: second,
        id: otherMap,
        title: "Operations map",
      }),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(storyMapsRoute(first));
    await eventually(() =>
      expect(find(root, q("story-map-row-counts")).textContent).toContain(
        "SM-01 · 1 story · 1 with backlog link",
      ),
    );
    expect(root.querySelectorAll(q("story-map-create"))).toHaveLength(1);
    expect(root.querySelectorAll(q("story-map-row"))).toHaveLength(1);
    await run(host.notes.removeOutside(itemPath));
    await eventually(() =>
      expect(find(root, q("story-map-row-counts")).textContent).toContain("0 with backlog link"),
    );
    await run(
      host.notes.seed(mapPath, {
        ...fields,
        project_id: first,
        id: mapId,
        title: "Outside map rename",
      }),
    );
    await eventually(() =>
      expect(find(root, q("story-map-row-title")).textContent).toBe("Outside map rename"),
    );
    await navigation.navigate(storyMapsRoute(second, mapId));
    await eventually(() =>
      expect(find(root, q("story-maps")).textContent).toContain(
        "This story map is unavailable in this project.",
      ),
    );
    await navigation.navigate(storyMapsRoute(second));
    await eventually(() =>
      expect(find(root, q("story-map-row-title")).textContent).toBe("Operations map"),
    );
    expect(find(root, q("story-map-row-counts")).textContent).toContain(
      "SM-01 · 1 story · 0 with backlog link",
    );
    click(root, "story-map-row");
    await eventually(() => expect(navigation.current()).toEqual(storyMapsRoute(second, otherMap)));
  });
});

it("derives a PRD from a saved Job and creates, cancels and reopens its linked native Story Map", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const id = "knowledge-33333333-3333-4333-8333-000000000126";
    const job = await run(
      createKnowledge(
        { projectId: first, id },
        {
          kind: "jtbd",
          title: "Shift handover",
          actor_type: "",
          owner_id: "",
          vision_id: "",
          job_ids: [],
        },
      ),
    );
    await run(
      host.notes.seed(
        job.path,
        job.frontmatter,
        "## Angestrebter Fortschritt\n\nGive the night shift the full queue.",
      ),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(knowledgeDetailRoute(first, id));
    await eventually(() => expect(find(root, q("knowledge-create-prd"))).toBeTruthy());
    click(root, "knowledge-create-prd");
    await eventually(() =>
      expect(root.querySelector('[role="dialog"] [name="title"]')).toBeTruthy(),
    );
    change(root, "title", "Handover requirements");
    find<HTMLButtonElement>(root, '[role="dialog"] button[type="submit"]').click();
    await eventually(() =>
      expect(find(root, `${q("knowledge-note")} h1`).textContent?.trim()).toBe(
        "Handover requirements",
      ),
    );
    await eventually(() => expect(root.querySelector(q("knowledge-note-actions"))).toBeTruthy());
    const prd = navigation.current();
    click(root, "knowledge-note-actions");
    await eventually(() =>
      expect(
        root.querySelector(q("knowledge-create-story-map")),
        "PRD Notizaktionen offers Story Map creation",
      ).toBeTruthy(),
    );
    click(root, "knowledge-create-story-map");
    await eventually(() =>
      expect(find<HTMLInputElement>(root, '[role="dialog"] [name="title"]').value).toBe(
        "Handover requirements",
      ),
    );
    expect(find<HTMLTextAreaElement>(root, '[role="dialog"] [name="goal"]').value).toBe(
      "Give the night shift the full queue.",
    );
    change(root, "title", "Discard this map");
    click(root, "story-map-cancel");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("knowledge-note-actions"))),
    );
    expect(root.querySelector(q("knowledge-story-map-backlink"))).toBeNull();
    click(root, "knowledge-note-actions");
    await eventually(() =>
      expect(root.querySelector(q("knowledge-create-story-map"))).toBeTruthy(),
    );
    click(root, "knowledge-create-story-map");
    await eventually(() =>
      expect(find<HTMLInputElement>(root, '[role="dialog"] [name="title"]').value).toBe(
        "Handover requirements",
      ),
    );
    change(root, "title", "Night shift map");
    change(root, "persona", "On-call coordinator");
    change(root, "goal", "Make the full queue available to the night shift");
    click(root, "story-map-submit");
    await eventually(() =>
      expect(find(root, q("story-map-detail")).textContent).toContain("Night shift map"),
    );
    const map = navigation.current();
    await navigation.navigate(storyMapsRoute(first));
    await eventually(() =>
      expect(find(root, q("story-map-row")).textContent).toContain("Night shift map"),
    );
    click(root, "story-map-row");
    await eventually(() => expect(navigation.current()).toEqual(map));
    await navigation.navigate(prd);
    await eventually(() =>
      expect(find(root, q("knowledge-story-map-backlink")).textContent).toContain(
        "Night shift map",
      ),
    );
    click(root, "knowledge-story-map-backlink");
    await eventually(() => expect(navigation.current()).toEqual(map));
    await eventually(() =>
      expect(root.querySelector(q("story-map-context-foundations"))).toBeTruthy(),
    );
    click(root, "story-map-context-foundations");
    await eventually(() =>
      expect(find(root, q("story-map-source-prd")).textContent).toContain("Handover requirements"),
    );
    click(root, "story-map-source-prd");
    await eventually(() =>
      expect(find(root, `${q("knowledge-note")} h1`).textContent?.trim()).toBe(
        "Handover requirements",
      ),
    );
    click(root, "project-record-return");
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, q("story-map-source-prd"))),
    );
    const store = await run(NoteStore);
    const source = (await run(store.list)).find(
      ({ frontmatter }) => frontmatter.title === "Handover requirements",
    );
    if (!source) throw new Error("Missing derived PRD fixture");
    await run(host.notes.removeOutside(source.path));
    await eventually(() =>
      expect(find(root, q("story-map-detail")).textContent).toContain(
        "The source PRD is unavailable",
      ),
    );
  });
});
