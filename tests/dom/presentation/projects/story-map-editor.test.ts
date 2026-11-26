import { expect, it } from "vitest";
import { pbiDetailRoute } from "../../../../src/application/backlog";
import { NoteStore, rebuildNoteIndex } from "../../../../src/application/notes";
import { storyMapsRoute } from "../../../../src/application/story-maps";
import type { MarkdownHost } from "../../../../src/presentation/shell/host";
import { eventually } from "../../../support/wait";
import { find, first, jobOne, jobTwo, seedFoundations, withProject } from "./knowledge-fixture";

const map = "story-map-33333333-3333-4333-8333-000000000715";
const item = "backlog-33333333-3333-4333-8333-000000000716";
const secondItem = "backlog-33333333-3333-4333-8333-000000000717";
const prd = "knowledge-33333333-3333-4333-8333-000000000718";
const missing = "knowledge-33333333-3333-4333-8333-000000000719";
const folder = "Product Engineering/Projects/Kundenportal";
const mapPath = folder + "/Story Maps/SM-01.md";
const image = "Sources/Brief.png";
const markdown: MarkdownHost = {
  render: async (content, _path, element) => {
    element.textContent = content;
  },
  files: () => [{ path: image, name: "Brief", kind: "image", headings: [] }],
  makeLink: () => undefined,
  resolve: (link) => (link.includes(image) ? { path: image, supported: true } : undefined),
  open: async () => undefined,
  noteLinks: () => ({ inline: [], inbound: [] }),
};
const testid = (id: string) => `[data-testid="${id}"]`;
const control = (root: HTMLElement, selector: string) => find<HTMLButtonElement>(root, selector);
const click = (root: HTMLElement, id: string) => control(root, testid(id)).click();
const context = (root: HTMLElement, part: string) => click(root, `story-map-context-${part}`);

function input(root: HTMLElement, name: string, value: string, event = "input") {
  const field = find<HTMLInputElement>(root, `[role="dialog"] [name="${name}"]`);
  field.value = value;
  field.dispatchEvent(new Event(event, { bubbles: true }));
}

function fixture(overrides = {}) {
  return {
    schema: "product-engineering.story-map/v1",
    id: map,
    project_id: first,
    display_id: "SM-01",
    title: "Prepare a handover",
    goal: "Hand off open cases",
    persona: "Coordinator",
    prd_id: missing,
    job_ids: [missing],
    activities: [{ id: "ACT-01", title: "Review the queue" }],
    steps: [{ id: "STEP-01", activityId: "ACT-01", title: "Open the queue" }],
    slices: [
      { id: "SL-01", title: "First delivery" },
      { id: "SL-02", title: "Later" },
    ],
    cards: [
      {
        id: "CARD-01",
        stepId: "STEP-01",
        sliceId: "SL-01",
        title: "See open cases",
        description: "List currently open service cases.",
      },
      { id: "CARD-02", stepId: "STEP-01", title: "Review manually" },
    ],
    card_links: [
      { kind: "item", projectId: first, cardId: "CARD-01", recordId: "UC-01" },
      { kind: "item", projectId: first, cardId: "CARD-01", recordId: "UC-02" },
      { kind: "item", projectId: first, cardId: "CARD-02", recordId: "UC-404" },
    ],
    ...overrides,
  };
}

it("keeps foundation drafts through duplicate Vault selections and a failed write, then clears the primary PRD", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    await seedFoundations(host);
    await run(
      host.notes.seed(folder + "/PRD-01.md", {
        schema: "product-engineering.knowledge/v1",
        id: prd,
        project_id: first,
        title: "Service requirements",
        kind: "prd",
        display_id: "PRD-01",
        approval: "draft",
      }),
    );
    await run(host.notes.seed(mapPath, fixture(), "\n# Handover workshop\n"));
    await run(rebuildNoteIndex);
    await navigation.navigate(storyMapsRoute(first, map));
    await eventually(() => expect(root.querySelector(testid("story-map-detail"))).toBeTruthy());
    context(root, "prototypes");
    await eventually(() => expect(root.textContent).toContain("No prototypes linked to this map."));
    context(root, "entities");
    await eventually(() => expect(root.querySelector(testid("domain-scope"))).toBeTruthy());
    context(root, "nfrs");
    await eventually(() => expect(root.querySelector(testid("nfr-assign"))).toBeTruthy());
    context(root, "foundations");
    await eventually(() => expect(root.textContent).toContain("source PRD is unavailable"));
    click(root, "story-map-foundation-edit");
    await eventually(() =>
      expect(root.querySelector(testid("story-map-foundation-form"))).toBeTruthy(),
    );
    input(root, "prdId", prd, "change");
    control(root, `[name="jobIds"][value="${missing}"]`).click();
    control(root, `[name="jobIds"][value="${jobOne}"]`).click();
    control(root, `[name="jobIds"][value="${jobTwo}"]`).click();
    async function pickAlias(alias: string) {
      click(root, "knowledge-add-reference");
      await eventually(() =>
        expect(root.querySelector(testid("knowledge-vault-picker"))).toBeTruthy(),
      );
      control(root, `[data-vault-file="${image}"]`).click();
      await eventually(() => expect(root.querySelector('[name="vault-alias"]')).toBeTruthy());
      input(root, "vault-alias", alias);
      click(root, "knowledge-vault-confirm");
      await eventually(() =>
        expect(root.querySelector(testid("knowledge-vault-picker"))).toBeNull(),
      );
    }
    await pickAlias("Workshop");
    await pickAlias("Duplicate");
    host.notes.setFailWrites(true);
    click(root, "story-map-foundation-save");
    await eventually(() =>
      expect(root.querySelector('[role="dialog"] [role="alert"]')).toBeTruthy(),
    );
    expect(find<HTMLInputElement>(root, '[name="prdId"]').value).toBe(prd);
    host.notes.setFailWrites(false);
    click(root, "story-map-foundation-save");
    await eventually(() =>
      expect(root.querySelector(testid("story-map-foundation-form"))).toBeNull(),
    );
    const saved = await run(store.readContent(mapPath));
    expect(saved.frontmatter).toMatchObject({
      prd_id: prd,
      job_ids: [jobOne, jobTwo],
      references: [`[[${image}|Workshop]]`],
    });
    expect(saved.body).toBe("\n# Handover workshop\n");
    click(root, "story-map-foundation-edit");
    await eventually(() =>
      expect(root.querySelector(testid("story-map-foundation-form"))).toBeTruthy(),
    );
    expect(find<HTMLInputElement>(root, '[name="prdId"]').value).toBe(prd);
    input(root, "prdId", "", "change");
    click(root, "story-map-foundation-save");
    await eventually(() =>
      expect(root.querySelector(testid("story-map-foundation-form"))).toBeNull(),
    );
    expect((await run(store.readFresh(mapPath))).frontmatter).not.toHaveProperty("prd_id");
  }, markdown);
}, 15_000);

it("keeps a map header draft when an outside writer edits the same field", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    await run(host.notes.seed(mapPath, fixture()));
    await run(rebuildNoteIndex);
    await navigation.navigate(storyMapsRoute(first, map));
    await eventually(() => expect(root.querySelector(testid("story-map-edit"))).toBeTruthy());
    click(root, "story-map-edit");
    await eventually(() => expect(root.querySelector(testid("story-map-submit"))).toBeTruthy());
    input(root, "title", "Unsaved title");
    await run(host.notes.seed(mapPath, fixture({ title: "Changed in Obsidian" })));
    await run(rebuildNoteIndex);
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent).toBe("Changed in Obsidian"),
    );
    click(root, "story-map-submit");
    const conflict = '[role="dialog"] [role="alert"]';
    await eventually(() =>
      expect(
        Boolean(root.querySelector(conflict)) || !root.querySelector(testid("story-map-submit")),
      ).toBe(true),
    );
    expect(
      root.querySelector(conflict),
      "A stale map header must keep its draft and show the conflict",
    ).toBeTruthy();
    expect(find<HTMLInputElement>(root, '[role="dialog"] [name="title"]').value).toBe(
      "Unsaved title",
    );
    click(root, "story-map-cancel");
    await eventually(() =>
      expect(root.querySelector("h1")?.textContent).toBe("Changed in Obsidian"),
    );
  });
});

it("edits the map header and story, requires a destination with multiple PBIs, and navigates its canonical backlinks", async () => {
  await withProject(async ({ root, host, navigation }) => {
    const run = host.runtime.runPromise.bind(host.runtime);
    const store = await run(NoteStore);
    await run(host.notes.seed(mapPath, fixture()));
    const backlog = [
      [item, "UC-01", "Review case"],
      [secondItem, "UC-02", "Confirm case"],
    ] as const;
    await Promise.all(
      backlog.map(([id, short, title]) =>
        run(
          host.notes.seed(folder + "/" + short + ".md", {
            schema: "product-engineering.backlog/v1",
            id,
            "pe-id": short,
            title,
            type: "PBI",
            project_id: first,
          }),
        ),
      ),
    );
    await run(rebuildNoteIndex);
    await navigation.navigate(storyMapsRoute(first, map));
    await eventually(() => expect(root.querySelector(testid("story-map-edit"))).toBeTruthy());
    click(root, "story-map-edit");
    await eventually(() => expect(root.querySelector(testid("story-map-submit"))).toBeTruthy());
    input(root, "goal", "  Share a clean list  ");
    click(root, "story-map-submit");
    await eventually(() => expect(root.querySelector(testid("story-map-submit"))).toBeNull());
    await eventually(() => expect(root.textContent).toContain("Share a clean list"));

    control(root, '[data-story-node="CARD-01"]').click();
    await eventually(() => expect(root.querySelector(testid("story-map-card-edit"))).toBeTruthy());
    click(root, "story-map-card-edit");
    await eventually(() =>
      expect(root.querySelector(testid("story-map-journey-save"))).toBeTruthy(),
    );
    input(root, "title", "");
    click(root, "story-map-journey-save");
    await eventually(() =>
      expect(root.querySelector('[name="title"][aria-invalid="true"]')).toBeTruthy(),
    );
    input(root, "title", "Review open handling");
    input(root, "sliceId", "", "change");
    click(root, "story-map-journey-save");
    await eventually(() =>
      expect(find(root, testid("story-map-cell-unsliced-STEP-01")).textContent).toContain(
        "Review open handling",
      ),
    );

    control(root, `${testid("story-map-card-CARD-01")} ${testid("story-map-work")}`).click();
    await eventually(() => expect(root.querySelector(testid("story-map-work-add"))).toBeTruthy());
    click(root, "story-map-work-add");
    await eventually(() => expect(root.querySelector(testid("story-map-work-save"))).toBeTruthy());
    expect(find<HTMLInputElement>(root, '[name="destination"]').value).toBe("");
    input(root, "title", "Escalate late cases");
    click(root, "story-map-work-save");
    await eventually(() =>
      expect(root.querySelector('[role="dialog"] [role="alert"]')).toBeTruthy(),
    );
    input(root, "destination", "story", "change");
    input(root, "kind", "BUG", "change");
    click(root, "story-map-work-save");
    await eventually(() =>
      expect(find(root, testid("story-map-owned-work")).textContent).toContain(
        "Escalate late cases",
      ),
    );
    const saved = await run(store.readFresh(mapPath));
    expect(saved.frontmatter).toMatchObject({ story_work: [{ kind: "BUG", cardId: "CARD-01" }] });
    const close = [...root.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
      (button) => button.textContent === "Close",
    );
    close?.click();
    await eventually(() => expect(root.querySelector(testid("story-map-work-add"))).toBeNull());
    control(root, '[data-story-item="UC-01"]').click();
    await eventually(() => expect(navigation.current()).toEqual(pbiDetailRoute(first, "UC-01")));
    await eventually(() => expect(root.querySelector(testid("pbi-tab-links"))).toBeTruthy());
    click(root, "pbi-tab-links");
    await eventually(() =>
      expect(root.querySelector('[data-map-card-link="CARD-01"]')).toBeTruthy(),
    );
    control(root, '[data-map-card-link="CARD-01"]').click();
    await eventually(() =>
      expect(navigation.current()).toEqual(storyMapsRoute(first, map, "CARD-01")),
    );
    await eventually(() =>
      expect(root.ownerDocument.activeElement).toBe(find(root, '[data-story-node="CARD-01"]')),
    );
  });
});
